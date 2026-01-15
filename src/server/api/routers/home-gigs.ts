import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, publicProcedure, adminProcedure } from "~/server/api/trpc";
import { HomeGigSection } from "~Prisma/client";

const HOME_RECENT_PAST_FEATURED_COUNT = 1;
const HOME_RECENT_PAST_LIST_COUNT = 2;

const isDefined = <T,>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;

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
        where: { section: HomeGigSection.FEATURED_RECENT_PAST },
        orderBy: { sortOrder: "asc" },
        select: { gigId: true },
      }),
      ctx.db.homeGigPlacement.findMany({
        where: { section: HomeGigSection.PAST_RECENT_LIST },
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

    // Pick featured from FEATURED_RECENT_PAST placements
    let featuredGig = featuredIds
      .map((id) => gigMap.get(id))
      .find(isDefined) ?? null;

    // Build past list from PAST_RECENT_LIST placements
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

    return { featuredGig, pastGigs };
  }),

  getPlacements: adminProcedure
    .input(
      z.object({
        section: z.enum(HomeGigSection),
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
        input.section === HomeGigSection.FEATURED_RECENT_PAST &&
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

