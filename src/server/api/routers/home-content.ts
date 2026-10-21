import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  HOME_ITEM_COUNT,
  contentVideoId,
  selectHomeContent,
} from "~/lib/home-content";
import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";
import {
  CONTENT_ARTWORK_INCLUDE,
  withContentArtwork,
} from "~/server/api/content-artwork";

export const homeContentRouter = createTRPCRouter({
  /** One playable YouTube video, then three items in the admin's chosen order. */
  getHomeLatest: publicProcedure.query(async ({ ctx }) => {
    const [items, placements] = await Promise.all([
      ctx.db.contentItem.findMany({
        orderBy: [{ date: "desc" }, { id: "asc" }],
        include: CONTENT_ARTWORK_INCLUDE,
      }),
      ctx.db.homeContentPlacement.findMany({ orderBy: { sortOrder: "asc" } }),
    ]);
    const selected = selectHomeContent(items, placements);
    return {
      video: selected.video ? withContentArtwork(selected.video) : null,
      items: selected.items.map(withContentArtwork),
    };
  }),

  /** Save the video and the three items together so Home never gets half a change. */
  setAllPlacements: adminProcedure
    .input(
      z.object({
        videoContentItemId: z.string().min(1),
        itemContentItemIds: z.array(z.string().min(1)).length(HOME_ITEM_COUNT),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ids = [input.videoContentItemId, ...input.itemContentItemIds];
      if (new Set(ids).size !== ids.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Choose four different content items.",
        });
      }
      await ctx.db.$transaction(async (tx) => {
        const items = await tx.contentItem.findMany({
          where: { id: { in: ids } },
        });
        if (items.length !== ids.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "One or more of those content items no longer exists.",
          });
        }
        const video = items.find(
          (item) => item.id === input.videoContentItemId,
        );
        if (!video || !contentVideoId(video)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Choose a playable YouTube video for the top slot.",
          });
        }
        await tx.homeContentPlacement.deleteMany({});
        await tx.homeContentPlacement.createMany({
          data: [
            {
              section: "VIDEO",
              contentItemId: input.videoContentItemId,
              sortOrder: 0,
            },
            ...input.itemContentItemIds.map((contentItemId, sortOrder) => ({
              section: "ITEMS" as const,
              contentItemId,
              sortOrder,
            })),
          ],
        });
      });
      return { ok: true as const };
    }),
});
