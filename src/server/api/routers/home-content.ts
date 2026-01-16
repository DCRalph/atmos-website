import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";
import { HomeContentSection } from "~Prisma/client";

const HOME_LATEST_FEATURED_COUNT = 1;
const HOME_LATEST_LIST_COUNT = 4;

const isDefined = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;

export const homeContentRouter = createTRPCRouter({
  /**
   * Public endpoint for the Home page “Latest Content” section.
   * Returns 1 featured item + up to 2 additional items, ordered by admin-defined placements.
   * Falls back to date-ordering when placements are missing/invalid.
   */
  getHomeLatest: publicProcedure.query(async ({ ctx }) => {
    const [featuredPlacements, listPlacements] = await Promise.all([
      ctx.db.homeContentPlacement.findMany({
        where: { section: HomeContentSection.FEATURED },
        orderBy: { sortOrder: "asc" },
        select: { contentItemId: true },
      }),
      ctx.db.homeContentPlacement.findMany({
        where: { section: HomeContentSection.PAST },
        orderBy: { sortOrder: "asc" },
        select: { contentItemId: true },
      }),
    ]);

    const featuredIds = featuredPlacements.map((p) => p.contentItemId);
    const listIds = listPlacements.map((p) => p.contentItemId);
    const placementIds = Array.from(new Set([...featuredIds, ...listIds]));

    const itemsFromPlacements = placementIds.length
      ? await ctx.db.contentItem.findMany({
        where: { id: { in: placementIds } },
      })
      : [];

    const itemMap = new Map(itemsFromPlacements.map((c) => [c.id, c]));

    // Pick featured from FEATURED placements
    let featuredItem =
      featuredIds.map((id) => itemMap.get(id)).find(isDefined) ?? null;

    // Build list from PAST placements (excluding featured)
    let listItems = listIds
      .map((id) => itemMap.get(id))
      .filter(isDefined)
      .filter((c) => c.id !== featuredItem?.id);

    // If featured is unset/invalid, promote first list placement (if any) to featured.
    if (!featuredItem && listItems.length > 0) {
      featuredItem = listItems[0] ?? null;
      listItems = listItems.slice(1);
    }

    // If still no featured, fall back to latest by date.
    if (!featuredItem) {
      featuredItem =
        (await ctx.db.contentItem.findFirst({
          orderBy: { date: "desc" },
        })) ?? null;
    }

    // Fill remaining list items up to desired count (date desc)
    const selectedIds = new Set<string>();
    if (featuredItem) selectedIds.add(featuredItem.id);
    for (const c of listItems) selectedIds.add(c.id);

    const missingCount = Math.max(0, HOME_LATEST_LIST_COUNT - listItems.length);
    if (missingCount > 0) {
      const fallback = await ctx.db.contentItem.findMany({
        where: { id: { notIn: Array.from(selectedIds) } },
        orderBy: { date: "desc" },
        take: missingCount,
      });
      listItems = [...listItems, ...fallback];
    }

    return {
      featuredItem,
      items: listItems.slice(0, HOME_LATEST_LIST_COUNT),
    };
  }),

  getPlacements: adminProcedure
    .input(
      z.object({
        section: z.nativeEnum(HomeContentSection),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.homeContentPlacement.findMany({
        where: { section: input.section },
        orderBy: { sortOrder: "asc" },
        include: {
          contentItem: {
            select: {
              id: true,
              type: true,
              title: true,
              dj: true,
              description: true,
              date: true,
              linkType: true,
              link: true,
            },
          },
        },
      });
    }),

  setPlacements: adminProcedure
    .input(
      z.object({
        section: z.nativeEnum(HomeContentSection),
        contentItemIds: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ids = Array.from(new Set(input.contentItemIds));

      if (
        input.section === HomeContentSection.FEATURED &&
        ids.length > HOME_LATEST_FEATURED_COUNT
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Featured placement can only contain 1 content item.",
        });
      }

      await ctx.db.$transaction(async (tx) => {
        await tx.homeContentPlacement.deleteMany({
          where: {
            section: input.section,
            contentItemId: { notIn: ids.length ? ids : ["__none__"] },
          },
        });

        await Promise.all(
          ids.map((contentItemId, sortOrder) =>
            tx.homeContentPlacement.upsert({
              where: {
                section_contentItemId: {
                  section: input.section,
                  contentItemId,
                },
              },
              create: {
                section: input.section,
                contentItemId,
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

