import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";

/**
 * Picking who is on a bill.
 *
 * All that is left of the old `gigCreators` router. Adding, removing, reordering
 * and editing a role each used to be their own mutation here; the run sheet is
 * now saved whole by `gigs.saveAll`, so they were deleted rather than left as a
 * second way to change a line-up that nothing calls. `listForGig` went with
 * them — it was a public read of the raw row, which since the run sheet landed
 * would have handed out set times and internal notes.
 */
export const lineUpRouter = createTRPCRouter({
  /**
   * Search creator profiles for the admin line-up picker.
   *
   * Prefix matches are fetched separately and listed first: typing "no" should
   * surface "Nova" ahead of "DJ Anonymous", which a single `contains` ordered by
   * name will not do. `total` counts everything that matches so the list can say
   * how much is behind the fold instead of silently truncating, and `excludeIds`
   * keeps profiles already on the bill out of both the page and the count.
   */
  searchProfiles: adminProcedure
    .input(
      z.object({
        query: z.string().default(""),
        /** Profiles already on the line-up. */
        excludeIds: z.array(z.string()).default([]),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const q = input.query.trim();
      const select = {
        id: true,
        handle: true,
        displayName: true,
        avatarFileId: true,
        claimStatus: true,
        isPublished: true,
      };
      const excluded =
        input.excludeIds.length > 0 ? { id: { notIn: input.excludeIds } } : {};

      // No query: the profiles worth offering are the ones touched most
      // recently, not the first few alphabetically.
      if (!q) {
        const [profiles, total] = await Promise.all([
          ctx.db.creatorProfile.findMany({
            where: excluded,
            orderBy: { updatedAt: "desc" },
            take: input.limit,
            select,
          }),
          ctx.db.creatorProfile.count({ where: excluded }),
        ]);
        return { profiles, total, isRecent: true as const };
      }

      const matches = {
        ...excluded,
        OR: [
          { handle: { contains: q, mode: "insensitive" as const } },
          { displayName: { contains: q, mode: "insensitive" as const } },
        ],
      };

      const [prefixed, contained, total] = await Promise.all([
        ctx.db.creatorProfile.findMany({
          where: {
            ...excluded,
            OR: [
              { handle: { startsWith: q, mode: "insensitive" as const } },
              { displayName: { startsWith: q, mode: "insensitive" as const } },
            ],
          },
          orderBy: { displayName: "asc" },
          take: input.limit,
          select,
        }),
        ctx.db.creatorProfile.findMany({
          where: matches,
          orderBy: { displayName: "asc" },
          take: input.limit,
          select,
        }),
        ctx.db.creatorProfile.count({ where: matches }),
      ]);

      const seen = new Set<string>();
      const profiles = [...prefixed, ...contained]
        .filter((profile) => {
          if (seen.has(profile.id)) return false;
          seen.add(profile.id);
          return true;
        })
        .slice(0, input.limit);

      return { profiles, total, isRecent: false as const };
    }),
});
