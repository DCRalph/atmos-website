import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import {
  FileUploadStatus,
  GigStatus,
  type Prisma,
  type PrismaClient,
} from "~Prisma/client";

const HOME_RECENT_MIN_COUNT = 3;

const isDefined = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;

/**
 * The home page is public, and there is no admin variant of it, so a draft is
 * never eligible here — not even for the admin who is writing it. Spread into
 * every `where` below, including the placement lookups: an admin can pin a gig
 * to the home page while it is still a draft, and it must not appear until it
 * is published.
 *
 * Affiliated gigs are excluded for the same reason they are absent from the
 * past gigs page — the flag exists so that somebody else's night leaves the
 * site once it is over — and every gig read here is a past one. Pinning one is
 * allowed and simply has no effect, exactly as pinning a draft does.
 */
const HOME_ELIGIBLE = {
  status: GigStatus.PUBLISHED,
  isAffiliated: false,
  // A TBA gig's dates are placeholders, so it has not been and gone either,
  // and nothing here redacts it. Same rule as `gigs.getPast`.
  isTba: false,
} as const;

type PosterInfo = { id: string; url: string; name: string; mimeType: string };

async function enrichGigsWithPosterFileUploads<
  T extends { posterFileUploadId: string | null },
>(
  db: Pick<PrismaClient, "file_upload">,
  gigs: T[],
): Promise<
  (T & {
    posterFileUpload: {
      id: string;
      url: string;
      name: string;
      mimeType: string;
    } | null;
  })[]
> {
  const posterIds = Array.from(
    new Set(
      gigs
        .map((g) => g.posterFileUploadId)
        .filter((id): id is string => id !== null),
    ),
  );

  if (posterIds.length === 0) {
    return gigs.map((g) => ({ ...g, posterFileUpload: null }));
  }

  const posters = await db.file_upload.findMany({
    where: {
      id: { in: posterIds },
      status: {
        notIn: [FileUploadStatus.DELETED, FileUploadStatus.SOFT_DELETED],
      },
    },
    select: {
      id: true,
      url: true,
      name: true,
      mimeType: true,
    },
  });

  const posterMap = new Map<string, PosterInfo>(posters.map((p) => [p.id, p]));

  return gigs.map((g) => ({
    ...g,
    posterFileUpload: g.posterFileUploadId
      ? (posterMap.get(g.posterFileUploadId) ?? null)
      : null,
  }));
}

export const homeGigsRouter = createTRPCRouter({
  /** One curated list, filled to at least three gigs with the latest eligible nights. */
  getHomeRecent: publicProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const placements = await ctx.db.homeGigPlacement.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { gigId: true },
    });
    const placementIds = placements.map((p) => p.gigId);
    const include = {
      media: {
        orderBy: [
          { section: "asc" },
          { sortOrder: "asc" },
          { createdAt: "asc" },
        ],
      },
      gigTags: { include: { gigTag: true } },
    } satisfies Prisma.GigInclude;
    const eligible = { ...HOME_ELIGIBLE, gigEndTime: { lt: now } };
    const placedGigs = placementIds.length
      ? await ctx.db.gig.findMany({
          where: { ...eligible, id: { in: placementIds } },
          include,
        })
      : [];
    const byId = new Map(placedGigs.map((gig) => [gig.id, gig]));
    let gigs = placementIds.map((id) => byId.get(id)).filter(isDefined);
    const missingCount = Math.max(0, HOME_RECENT_MIN_COUNT - gigs.length);

    if (missingCount > 0) {
      const fallback = await ctx.db.gig.findMany({
        where: { ...eligible, id: { notIn: gigs.map((gig) => gig.id) } },
        orderBy: [{ gigEndTime: "desc" }, { id: "asc" }],
        take: missingCount,
        include,
      });
      gigs = [...gigs, ...fallback];
    }

    return enrichGigsWithPosterFileUploads(ctx.db, gigs);
  }),

  getPlacements: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.homeGigPlacement.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: {
        gig: {
          select: {
            id: true,
            slug: true,
            title: true,
            subtitle: true,
            gigStartTime: true,
            gigEndTime: true,
          },
        },
      },
    });
  }),

  /** Save the complete ordering atomically, including clearing the list. */
  setPlacements: adminProcedure
    .input(z.object({ gigIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const gigIds = Array.from(new Set(input.gigIds));
      if (gigIds.length > 0) {
        const found = await ctx.db.gig.count({
          where: { id: { in: gigIds } },
        });
        if (found !== gigIds.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "One or more of those gigs no longer exists",
          });
        }
      }

      await ctx.db.$transaction(async (tx) => {
        await tx.homeGigPlacement.deleteMany({
          where: gigIds.length ? { gigId: { notIn: gigIds } } : {},
        });
        for (const [sortOrder, gigId] of gigIds.entries()) {
          await tx.homeGigPlacement.upsert({
            where: { gigId },
            create: { gigId, sortOrder },
            update: { sortOrder },
          });
        }
      });

      return { ok: true as const };
    }),
});
