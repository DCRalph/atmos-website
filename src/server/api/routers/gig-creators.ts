import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { logUserActivity } from "~/server/utils/activity-log";
import { ActivityType } from "~Prisma/client";

export const gigCreatorsRouter = createTRPCRouter({
  listForGig: publicProcedure
    .input(z.object({ gigId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.gigCreator.findMany({
        where: { gigId: input.gigId },
        orderBy: { sortOrder: "asc" },
        include: {
          creatorProfile: {
            select: {
              id: true,
              handle: true,
              displayName: true,
              avatarFileId: true,
              tagline: true,
              isPublished: true,
              claimStatus: true,
            },
          },
        },
      });
    }),

  addCreatorToGig: adminProcedure
    .input(
      z.object({
        gigId: z.string(),
        creatorProfileId: z.string(),
        role: z.string().max(80).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [gig, profile] = await Promise.all([
        ctx.db.gig.findUnique({
          where: { id: input.gigId },
          select: { id: true, title: true },
        }),
        ctx.db.creatorProfile.findUnique({
          where: { id: input.creatorProfileId },
          select: { id: true, handle: true },
        }),
      ]);
      if (!gig || !profile) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const last = await ctx.db.gigCreator.findFirst({
        where: { gigId: input.gigId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      const created = await ctx.db.gigCreator.upsert({
        where: {
          gigId_creatorProfileId: {
            gigId: input.gigId,
            creatorProfileId: input.creatorProfileId,
          },
        },
        update: { role: input.role ?? null },
        create: {
          gigId: input.gigId,
          creatorProfileId: input.creatorProfileId,
          role: input.role ?? null,
          sortOrder: (last?.sortOrder ?? -1) + 1,
        },
      });
      await logUserActivity(
        ActivityType.GIG_CREATOR_ADDED,
        `Added @${profile.handle} to gig "${gig.title}"`,
        ctx.session.user.id,
        undefined,
        { gigId: input.gigId, creatorProfileId: input.creatorProfileId },
      );
      return created;
    }),

  removeCreatorFromGig: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.gigCreator.findUnique({
        where: { id: input.id },
        include: {
          gig: { select: { title: true } },
          creatorProfile: { select: { handle: true } },
        },
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db.gigCreator.delete({ where: { id: input.id } });
      await logUserActivity(
        ActivityType.GIG_CREATOR_REMOVED,
        `Removed @${row.creatorProfile.handle} from gig "${row.gig.title}"`,
        ctx.session.user.id,
        undefined,
        { gigCreatorId: input.id },
      );
      return { ok: true as const };
    }),

  updateRole: adminProcedure
    .input(z.object({ id: z.string(), role: z.string().max(80).nullable() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.gigCreator.update({
        where: { id: input.id },
        data: { role: input.role },
      });
    }),

  reorderCreators: adminProcedure
    .input(
      z.object({
        gigId: z.string(),
        orderedIds: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction(
        input.orderedIds.map((id, idx) =>
          ctx.db.gigCreator.update({
            where: { id },
            data: { sortOrder: idx },
          }),
        ),
      );
      return { ok: true as const };
    }),

  /** Search creator profiles for the admin gig picker. */
  searchProfiles: adminProcedure
    .input(z.object({ query: z.string().default("") }))
    .query(async ({ ctx, input }) => {
      const q = input.query.toLowerCase().trim();
      return ctx.db.creatorProfile.findMany({
        where: q
          ? {
              OR: [
                { handle: { contains: q, mode: "insensitive" as const } },
                { displayName: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : undefined,
        orderBy: { displayName: "asc" },
        take: 30,
        select: {
          id: true,
          handle: true,
          displayName: true,
          avatarFileId: true,
          claimStatus: true,
        },
      });
    }),
});
