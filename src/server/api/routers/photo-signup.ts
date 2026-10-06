import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { ActivityType, GigStatus } from "~Prisma/client";
import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";
import {
  assertSlugFree,
  readLinkInput,
} from "~/server/api/routers/short-links";
import { linkHosts } from "~/lib/short-links/domains";
import { sendPhotosEmail } from "~/server/photo-signup";
import { logActivity } from "~/server/utils/activity-log";

/**
 * Gig photo signup: people leave an email on `/gigs/[id]/photo-signup` and
 * get one email when the photos are up.
 *
 * The page is reached through a short link with a named QR code per spot in
 * the venue. The short link counts scans by code, and the redirect carries the
 * code onto the page, so each signup records the code that brought it. That
 * gives scans and emails per code side by side.
 */

/** One row of the numbers: a QR code, or everything that came without one. */
type SourceRow = {
  qrCodeId: string | null;
  name: string;
  code: string | null;
  scans: number;
  people: number;
  emails: number;
};

export const photoSignupRouter = createTRPCRouter({
  /**
   * Leave an email. Signing up a second time is a no-op that keeps the first
   * code. Also joins the newsletter, which the page tells them.
   */
  signup: publicProcedure
    .input(
      z.object({
        gigId: z.string(),
        email: z.string().trim().toLowerCase().max(254).email(),
        /** The `?c=` the short link carried over, if any. */
        code: z.string().max(16).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const gig = await ctx.db.gig.findFirst({
        where: { id: input.gigId, status: GigStatus.PUBLISHED, isTba: false },
        select: { id: true },
      });
      if (!gig) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Gig not found" });
      }

      // Only a code on this gig's own link counts. Anything else is a visit.
      const qr = input.code
        ? await ctx.db.shortLinkQrCode.findFirst({
            where: {
              code: input.code,
              link: { photoSignupGig: { id: gig.id } },
            },
            select: { name: true },
          })
        : null;
      const source = qr?.name ?? null;
      await ctx.db.$transaction([
        ctx.db.gigPhotoSignup.upsert({
          where: { gigId_email: { gigId: gig.id, email: input.email } },
          create: { gigId: gig.id, email: input.email, source },
          update: {},
        }),
        ctx.db.newsletterSubscription.upsert({
          where: { email: input.email },
          create: { email: input.email },
          update: { removed: false },
        }),
      ]);

      return { ok: true };
    }),

  /** Everything the gig editor's panel shows. */
  forGig: adminProcedure
    .input(z.object({ gigId: z.string() }))
    .query(async ({ ctx, input }) => {
      const gig = await ctx.db.gig.findUnique({
        where: { id: input.gigId },
        select: {
          photoSignupLink: {
            include: { qrCodes: { orderBy: { createdAt: "asc" } } },
          },
          _count: { select: { media: { where: { type: "photo" } } } },
        },
      });
      if (!gig) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Gig not found" });
      }

      const link = gig.photoSignupLink;
      const linkId = link?.id ?? "";
      const codes = link?.qrCodes ?? [];
      const names = codes.map((qr) => qr.name);
      const [clicks, [visitors], signups, extra] = await Promise.all([
        // A row per current QR code. Everything else, including a deleted
        // code's history, is one "no code" row (null), so the rows add up.
        ctx.db.$queryRaw<
          { source: string | null; scans: number; people: number }[]
        >`
          select case when source = any(${names}::text[]) then source end as source,
            count(*)::int as scans,
            count(distinct visitor)::int as people
          from short_link_click
          where "linkId" = ${linkId} and device <> 'bot'
          group by 1
        `,
        // People overall, not a sum: one person can scan two codes.
        ctx.db.$queryRaw<{ people: number }[]>`
          select count(distinct visitor)::int as people
          from short_link_click
          where "linkId" = ${linkId} and device <> 'bot'
        `,
        ctx.db.gigPhotoSignup.findMany({
          where: { gigId: input.gigId },
          orderBy: { createdAt: "desc" },
          select: {
            email: true,
            source: true,
            createdAt: true,
            notifiedAt: true,
          },
        }),
        ctx.db.shortLinkDomain.findMany({
          orderBy: { createdAt: "asc" },
          select: { host: true },
        }),
      ]);

      const rows: SourceRow[] = codes.map((qr) => ({
        qrCodeId: qr.id,
        name: qr.name,
        code: qr.code,
        scans: 0,
        people: 0,
        emails: 0,
      }));
      const other: SourceRow = {
        qrCodeId: null,
        name: "No code",
        code: null,
        scans: 0,
        people: 0,
        emails: 0,
      };
      const rowFor = (source: string | null) =>
        rows.find((row) => row.name === source) ?? other;

      for (const click of clicks) {
        Object.assign(rowFor(click.source), {
          scans: click.scans,
          people: click.people,
        });
      }
      for (const signup of signups) rowFor(signup.source).emails += 1;

      return {
        link: link && {
          id: link.id,
          slug: link.slug,
          active: link.active,
          hosts: linkHosts(
            link.domain,
            extra.map((row) => row.host),
          ),
        },
        hasPhotos: gig._count.media > 0,
        rows: other.scans || other.emails ? [...rows, other] : rows,
        totals: {
          scans: clicks.reduce((sum, row) => sum + row.scans, 0),
          people: visitors?.people ?? 0,
          emails: signups.length,
        },
        pending: signups.filter((s) => !s.notifiedAt).length,
        signups,
      };
    }),

  /** Make the gig's short link, which its QR codes then hang off. */
  createLink: adminProcedure
    .input(
      z.object({
        gigId: z.string(),
        domain: z.string().max(253),
        slug: z.string().max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const gig = await ctx.db.gig.findUnique({
        where: { id: input.gigId },
        select: { id: true, title: true, photoSignupLinkId: true },
      });
      if (!gig) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Gig not found" });
      }
      if (gig.photoSignupLinkId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This gig already has a photo signup link.",
        });
      }

      const values = await readLinkInput({
        domain: input.domain,
        slug: input.slug,
        // The cuid rather than the title slug, so renaming the gig never
        // breaks a code that's already printed.
        destination: `/gigs/${gig.id}/photo-signup`,
        label: `Photo signup: ${gig.title}`.slice(0, 120),
        active: true,
      });
      await assertSlugFree(values.domain, values.slug);

      const link = await ctx.db.shortLink.create({
        data: {
          ...values,
          createdBy: ctx.session.user.id,
          photoSignupGig: { connect: { id: gig.id } },
        },
      });

      await logActivity({
        type: ActivityType.SHORT_LINK_CREATED,
        action: `Created photo signup link ${link.domain}/${link.slug}`,
        userId: ctx.session.user.id,
        details: { linkId: link.id, gigId: gig.id },
      });

      return link;
    }),

  /** Email every signup that has not had the photos email yet. */
  sendPhotos: adminProcedure
    .input(z.object({ gigId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const photos = await ctx.db.gigMedia.count({
        where: { gigId: input.gigId, type: "photo" },
      });
      if (!photos) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Add the photos to the gallery first.",
        });
      }

      const result = await sendPhotosEmail(input.gigId);

      await logActivity({
        type: ActivityType.GIG_PHOTOS_EMAILED,
        action: `Emailed ${result.sent} photo signups`,
        userId: ctx.session.user.id,
        details: { gigId: input.gigId, ...result },
      });

      return result;
    }),
});
