import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  HOME_GRID_CELLS,
  layoutHomeContent,
  placementSlots,
  tileCells,
  tileSpan,
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
  /** Home's 3 x 2 grid: the admin's saved tiles, with empty cells filled by the newest content. */
  getHomeLatest: publicProcedure.query(async ({ ctx }) => {
    const [items, placements] = await Promise.all([
      ctx.db.contentItem.findMany({
        orderBy: [{ date: "desc" }, { id: "asc" }],
        include: CONTENT_ARTWORK_INCLUDE,
      }),
      ctx.db.homeContentPlacement.findMany({ orderBy: { sortOrder: "asc" } }),
    ]);
    return layoutHomeContent(
      items.map(withContentArtwork),
      placementSlots(placements),
    );
  }),

  /** Replace the whole grid at once so Home never shows half a change. Unlisted cells fill automatically. */
  setLayout: adminProcedure
    .input(
      z.object({
        tiles: z
          .array(
            z.object({
              slot: z
                .number()
                .int()
                .min(0)
                .max(HOME_GRID_CELLS - 1),
              contentItemId: z.string().min(1),
            }),
          )
          .max(HOME_GRID_CELLS),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ids = input.tiles.map((t) => t.contentItemId);
      if (new Set(ids).size !== ids.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Each content item can only appear once.",
        });
      }
      await ctx.db.$transaction(async (tx) => {
        const items = await tx.contentItem.findMany({
          where: { id: { in: ids } },
        });
        const byId = new Map(items.map((item) => [item.id, item]));
        const taken = new Set<number>();
        for (const tile of input.tiles) {
          const item = byId.get(tile.contentItemId);
          if (!item) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "One or more of those content items no longer exists.",
            });
          }
          const cells = tileCells(tile.slot, tileSpan(item));
          if (!cells || cells.some((c) => taken.has(c))) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `"${item.title}" doesn't fit there. Videos need two squares side by side.`,
            });
          }
          for (const c of cells) taken.add(c);
        }
        await tx.homeContentPlacement.deleteMany({});
        await tx.homeContentPlacement.createMany({
          data: input.tiles.map((tile) => ({
            section: "ITEMS" as const,
            contentItemId: tile.contentItemId,
            sortOrder: tile.slot,
          })),
        });
      });
      return { ok: true as const };
    }),
});
