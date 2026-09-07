import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { FileUploadStatus, HomeGigSection } from "~Prisma/client";

const HOME_RECENT_PAST_FEATURED_COUNT = 1;
const HOME_RECENT_PAST_LIST_COUNT = 2;

const isDefined = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;

type PosterInfo = { id: string; url: string; name: string; mimeType: string };

/**
 * Just the slice of the client this needs. `file_upload` is a raw table name
 * rather than a mapped model, so it is reached through this narrow shape
 * instead of leaving the whole client untyped.
 */
type PosterReader = {
  file_upload: {
    findMany: (args: unknown) => Promise<PosterInfo[]>;
  };
};

async function enrichGigsWithPosterFileUploads<
  T extends { posterFileUploadId: string | null },
>(
  db: unknown,
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

  const posters = await (db as PosterReader).file_upload.findMany({
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
  /**
   * Public endpoint for the Home page “Recent Gigs” section.
   * Returns a featured past gig and up to 2 additional past gigs, ordered by admin-defined placements.
   * Falls back to date-ordering when placements are missing/invalid.
   */
  getHomeRecent: publicProcedure.query(async ({ ctx }) => {
    const now = new Date();

    const [featuredPlacements, pastPlacements] = await Promise.all([
      ctx.db.homeGigPlacement.findMany({
        where: { section: HomeGigSection.FEATURED },
        orderBy: { sortOrder: "asc" },
        select: { gigId: true },
      }),
      ctx.db.homeGigPlacement.findMany({
        where: { section: HomeGigSection.PAST },
        orderBy: { sortOrder: "asc" },
        select: { gigId: true },
      }),
    ]);

    const featuredIds = featuredPlacements.map((p) => p.gigId);
    const pastIds = pastPlacements.map((p) => p.gigId);
    const placementIds = Array.from(new Set([...featuredIds, ...pastIds]));

    const gigsFromPlacements = placementIds.length
      ? await ctx.db.gig.findMany({
          where: {
            id: { in: placementIds },
            gigEndTime: { lt: now },
          },
          include: {
            media: {
              orderBy: [
                { section: "asc" },
                { sortOrder: "asc" },
                { createdAt: "asc" },
              ],
            },
            gigTags: {
              include: { gigTag: true },
            },
          },
        })
      : [];

    const gigMap = new Map(gigsFromPlacements.map((g) => [g.id, g]));

    // Pick featured from FEATURED placements
    let featuredGig =
      featuredIds.map((id) => gigMap.get(id)).find(isDefined) ?? null;

    // Build past list from PAST placements
    let pastGigs = pastIds
      .map((id) => gigMap.get(id))
      .filter(isDefined)
      .filter((g) => g.id !== featuredGig?.id);

    // If featured is unset/invalid, promote the first past placement (if any) to featured.
    if (!featuredGig && pastGigs.length > 0) {
      featuredGig = pastGigs[0] ?? null;
      pastGigs = pastGigs.slice(1);
    }

    // If still no featured, fall back to latest past gig.
    if (!featuredGig) {
      const fallbackFeatured = await ctx.db.gig.findFirst({
        where: { gigEndTime: { lt: now } },
        orderBy: { gigEndTime: "desc" },
        include: {
          media: {
            orderBy: [
              { section: "asc" },
              { sortOrder: "asc" },
              { createdAt: "asc" },
            ],
          },
          gigTags: {
            include: { gigTag: true },
          },
        },
      });
      featuredGig = fallbackFeatured ?? null;
    }

    // Fill remaining past gigs up to the desired count.
    const selectedIds = new Set<string>();
    if (featuredGig) selectedIds.add(featuredGig.id);
    for (const g of pastGigs) selectedIds.add(g.id);

    const missingPastCount = Math.max(
      0,
      HOME_RECENT_PAST_LIST_COUNT - pastGigs.length,
    );

    if (missingPastCount > 0) {
      const fallbackPast = await ctx.db.gig.findMany({
        where: {
          gigEndTime: { lt: now },
          id: { notIn: Array.from(selectedIds) },
        },
        orderBy: { gigEndTime: "desc" },
        take: missingPastCount,
        include: {
          media: {
            orderBy: [
              { section: "asc" },
              { sortOrder: "asc" },
              { createdAt: "asc" },
            ],
          },
          gigTags: {
            include: { gigTag: true },
          },
        },
      });
      pastGigs = [...pastGigs, ...fallbackPast];
    }

    // Ensure output is capped.
    // pastGigs = pastGigs.slice(0, HOME_RECENT_PAST_LIST_COUNT);

    const gigsToEnrich = [featuredGig, ...pastGigs].filter(isDefined);
    const withPosters = await enrichGigsWithPosterFileUploads(
      ctx.db,
      gigsToEnrich,
    );
    const byId = new Map(withPosters.map((g) => [g.id, g]));

    return {
      featuredGig: featuredGig
        ? (byId.get(featuredGig.id) ?? featuredGig)
        : null,
      pastGigs: pastGigs.map((g) => byId.get(g.id) ?? g),
    };
  }),

  getPlacements: adminProcedure
    .input(
      z.object({
        section: z.nativeEnum(HomeGigSection),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.homeGigPlacement.findMany({
        where: { section: input.section },
        orderBy: { sortOrder: "asc" },
        include: {
          gig: {
            select: {
              id: true,
              title: true,
              subtitle: true,
              gigStartTime: true,
              gigEndTime: true,
            },
          },
        },
      });
    }),

  /**
   * Both sections in one transaction.
   *
   * The reorder tab commits featured and past together behind a single Save, and
   * doing that as two `setPlacements` calls meant one could land while the other
   * failed — leaving Home showing a half-applied arrangement that matched
   * neither what was there before nor what was asked for.
   */
  setAllPlacements: adminProcedure
    .input(
      z.object({
        featuredGigIds: z.array(z.string()),
        pastGigIds: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const featured = Array.from(new Set(input.featuredGigIds));
      const past = Array.from(new Set(input.pastGigIds));

      if (featured.length > HOME_RECENT_PAST_FEATURED_COUNT) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Featured placement can only contain ${HOME_RECENT_PAST_FEATURED_COUNT} gig.`,
        });
      }

      const referenced = Array.from(new Set([...featured, ...past]));
      if (referenced.length > 0) {
        const found = await ctx.db.gig.count({
          where: { id: { in: referenced } },
        });
        if (found !== referenced.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "One or more of those gigs no longer exists",
          });
        }
      }

      await ctx.db.$transaction(async (tx) => {
        for (const [section, gigIds] of [
          [HomeGigSection.FEATURED, featured],
          [HomeGigSection.PAST, past],
        ] as const) {
          // Spelled out rather than relying on `notIn: []`, so clearing a
          // section actually clears it.
          await tx.homeGigPlacement.deleteMany({
            where:
              gigIds.length > 0
                ? { section, gigId: { notIn: gigIds } }
                : { section },
          });
          for (const [sortOrder, gigId] of gigIds.entries()) {
            await tx.homeGigPlacement.upsert({
              where: { section_gigId: { section, gigId } },
              create: { section, gigId, sortOrder },
              update: { sortOrder },
            });
          }
        }
      });

      return { ok: true as const };
    }),

  setPlacements: adminProcedure
    .input(
      z.object({
        section: z.nativeEnum(HomeGigSection),
        gigIds: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const gigIds = Array.from(new Set(input.gigIds));

      if (
        input.section === HomeGigSection.FEATURED &&
        gigIds.length > HOME_RECENT_PAST_FEATURED_COUNT
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Featured placement can only contain 1 gig.",
        });
      }

      await ctx.db.$transaction(async (tx) => {
        await tx.homeGigPlacement.deleteMany({
          where: {
            section: input.section,
            gigId: { notIn: gigIds.length ? gigIds : ["__none__"] },
          },
        });

        await Promise.all(
          gigIds.map((gigId, sortOrder) =>
            tx.homeGigPlacement.upsert({
              where: {
                section_gigId: {
                  section: input.section,
                  gigId,
                },
              },
              create: {
                section: input.section,
                gigId,
                sortOrder,
              },
              update: {
                sortOrder,
              },
            }),
          ),
        );
      });

      return { ok: true };
    }),
});
