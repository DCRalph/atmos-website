import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { ActivityType } from "~Prisma/client";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { newQrCode } from "~/lib/short-links/clicks";
import { LINK_DOMAIN_VALUES, shortLinkUrl } from "~/lib/short-links/domains";
import {
  destinationProblem,
  normaliseSlug,
  slugProblem,
} from "~/lib/short-links/rules";
import { logActivity } from "~/server/utils/activity-log";
import { db } from "~/server/db";

/**
 * Short links from the admin side: the list with its counts, one link's
 * numbers, the writes, and each link's named QR codes. The redirect itself is
 * `~/server/short-links`.
 *
 * Bots are recorded but excluded from every count here, so "clicks" means the
 * same thing in the list and on a link's own page.
 */

const linkInputSchema = z.object({
  domain: z.enum(LINK_DOMAIN_VALUES),
  slug: z.string().max(200),
  destination: z.string().max(2000),
  label: z.string().max(120),
  active: z.boolean(),
});

type LinkInput = z.infer<typeof linkInputSchema>;

/** The input, normalised and checked, or a BAD_REQUEST naming what's wrong. */
function readLinkInput(input: LinkInput) {
  const slug = normaliseSlug(input.slug);
  const problem =
    slugProblem(slug, input.domain) ?? destinationProblem(input.destination);
  if (problem) throw new TRPCError({ code: "BAD_REQUEST", message: problem });

  return {
    domain: input.domain,
    slug,
    destination: input.destination.trim(),
    label: input.label.trim() || null,
    active: input.active,
  };
}

async function assertSlugFree(
  domain: string,
  slug: string,
  excludingId?: string,
) {
  const existing = await db.shortLink.findUnique({
    where: { domain_slug: { domain, slug } },
    select: { id: true },
  });
  if (existing && existing.id !== excludingId) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `${domain}/${slug} is already a link.`,
    });
  }
}

/** Calendar days in NZ, oldest first, ending today: "2026-10-04". */
function recentNzDays(count: number): string[] {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Auckland",
  }).format(new Date());
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.UTC(y, m - 1, d - (count - 1 - i)))
      .toISOString()
      .slice(0, 10),
  );
}

/** How many clicks carried one value of one column: "Android, 41". */
type Slice = { label: string; n: number };

/** The columns a link's traffic is broken down by. */
type Dimension = "source" | "device" | "browser" | "os";

export const shortLinksRouter = createTRPCRouter({
  list: adminProcedure.query(async ({ ctx }) => {
    const [links, counts] = await Promise.all([
      ctx.db.shortLink.findMany({ orderBy: { createdAt: "desc" } }),
      ctx.db.$queryRaw<
        {
          linkId: string;
          clicks: number;
          visitors: number;
          lastClickAt: Date | null;
        }[]
      >`
        select "linkId",
          (count(*) filter (where device <> 'bot'))::int as clicks,
          (count(distinct visitor) filter (where device <> 'bot'))::int as visitors,
          max("createdAt") filter (where device <> 'bot') as "lastClickAt"
        from short_link_click
        group by "linkId"
      `,
    ]);

    const byLink = new Map(counts.map((row) => [row.linkId, row]));
    return links.map((link) => {
      const count = byLink.get(link.id);
      return {
        ...link,
        url: shortLinkUrl(link.domain, link.slug),
        clicks: count?.clicks ?? 0,
        visitors: count?.visitors ?? 0,
        lastClickAt: count?.lastClickAt ?? null,
      };
    });
  }),

  /** One link with everything its page shows. */
  byId: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const link = await ctx.db.shortLink.findUnique({
        where: { id: input.id },
        include: { qrCodes: { orderBy: { createdAt: "asc" } } },
      });
      if (!link) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Link not found" });
      }

      const days = recentNzDays(30);
      const [[totals], daily, slices, recent] = await Promise.all([
        ctx.db.$queryRaw<{ clicks: number; visitors: number; bots: number }[]>`
          select
            (count(*) filter (where device <> 'bot'))::int as clicks,
            (count(distinct visitor) filter (where device <> 'bot'))::int as visitors,
            (count(*) filter (where device = 'bot'))::int as bots
          from short_link_click
          where "linkId" = ${link.id}
        `,
        // Prisma stores UTC in a plain timestamp, so it is marked as UTC before
        // converting: a click at 11pm belongs to that night, not tomorrow.
        ctx.db.$queryRaw<{ day: string; n: number }[]>`
          select
            to_char(("createdAt" at time zone 'UTC') at time zone 'Pacific/Auckland', 'YYYY-MM-DD') as day,
            count(*)::int as n
          from short_link_click
          where "linkId" = ${link.id}
            and device <> 'bot'
            and "createdAt" >= now() - interval '32 days'
          group by day
        `,
        ctx.db.$queryRaw<{ dimension: Dimension; label: string; n: number }[]>`
          select d.dimension, d.label, count(*)::int as n
          from short_link_click c,
            lateral (values
              ('source', c.source),
              ('device', c.device),
              ('browser', c.browser),
              ('os', c.os)
            ) as d(dimension, label)
          where c."linkId" = ${link.id} and c.device <> 'bot'
          group by d.dimension, d.label
          order by n desc
        `,
        // Bots included: when a link looks wrong, the odd row explains it.
        ctx.db.shortLinkClick.findMany({
          where: { linkId: link.id },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
      ]);

      const perDay = new Map(daily.map((row) => [row.day, row.n]));
      const breakdown: Record<Dimension, Slice[]> = {
        source: [],
        device: [],
        browser: [],
        os: [],
      };
      for (const { dimension, label, n } of slices) {
        breakdown[dimension].push({ label, n });
      }

      return {
        ...link,
        url: shortLinkUrl(link.domain, link.slug),
        qrCodes: link.qrCodes.map((qr) => ({
          ...qr,
          url: shortLinkUrl(link.domain, link.slug, qr.code),
        })),
        totals: totals ?? { clicks: 0, visitors: 0, bots: 0 },
        daily: days.map((day) => ({ day, n: perDay.get(day) ?? 0 })),
        breakdown,
        recent,
      };
    }),

  create: adminProcedure
    .input(linkInputSchema)
    .mutation(async ({ ctx, input }) => {
      const values = readLinkInput(input);
      await assertSlugFree(values.domain, values.slug);

      const created = await ctx.db.shortLink.create({
        data: { ...values, createdBy: ctx.session.user.id },
      });

      await logActivity({
        type: ActivityType.SHORT_LINK_CREATED,
        action: `Created short link ${created.domain}/${created.slug}`,
        userId: ctx.session.user.id,
        details: { linkId: created.id, destination: created.destination },
      });

      return created;
    }),

  update: adminProcedure
    .input(linkInputSchema.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const values = readLinkInput(rest);
      await assertSlugFree(values.domain, values.slug, id);

      const updated = await ctx.db.shortLink.update({
        where: { id },
        data: values,
      });

      await logActivity({
        type: ActivityType.SHORT_LINK_UPDATED,
        action: `Updated short link ${updated.domain}/${updated.slug}`,
        userId: ctx.session.user.id,
        details: { linkId: updated.id, destination: updated.destination },
      });

      return updated;
    }),

  /** The switch in the list. Turning a link off keeps its clicks. */
  setActive: adminProcedure
    .input(z.object({ id: z.string(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.shortLink.update({
        where: { id: input.id },
        data: { active: input.active },
      });

      await logActivity({
        type: ActivityType.SHORT_LINK_UPDATED,
        action: `${input.active ? "Switched on" : "Switched off"} short link ${updated.domain}/${updated.slug}`,
        userId: ctx.session.user.id,
        details: { linkId: updated.id },
      });

      return updated;
    }),

  /** Takes the clicks with it, which is why the form offers switching off. */
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db.shortLink.delete({
        where: { id: input.id },
      });

      await logActivity({
        type: ActivityType.SHORT_LINK_DELETED,
        action: `Deleted short link ${deleted.domain}/${deleted.slug}`,
        userId: ctx.session.user.id,
        details: { linkId: deleted.id, destination: deleted.destination },
      });

      return { ok: true };
    }),

  createQrCode: adminProcedure
    .input(z.object({ linkId: z.string(), name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const name = input.name.trim().slice(0, 48);
      if (!name) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Name where it's going up.",
        });
      }

      const taken = await ctx.db.shortLinkQrCode.findUnique({
        where: { linkId_name: { linkId: input.linkId, name } },
        select: { id: true },
      });
      if (taken) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `There's already a QR code called "${name}".`,
        });
      }

      return ctx.db.shortLinkQrCode.create({
        data: { linkId: input.linkId, name, code: newQrCode() },
      });
    }),

  /**
   * The printed code keeps redirecting and its past scans keep its name; only
   * new scans stop being told apart from any other visit.
   */
  deleteQrCode: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.shortLinkQrCode.delete({ where: { id: input.id } });
      return { ok: true };
    }),
});
