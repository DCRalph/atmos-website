import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { ActivityType } from "~Prisma/client";

export const activityLogsRouter = createTRPCRouter({
  getAll: adminProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(50),
          cursor: z.string().optional(),
          type: z.nativeEnum(ActivityType).optional(),
          userId: z.string().optional(), // Filter by user who performed action
          targetUserId: z.string().optional(), // Filter by target user
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const cursor = input?.cursor;

      const where = {
        ...(input?.type && { type: input.type }),
        ...(input?.userId && { userId: input.userId }),
        ...(input?.targetUserId && { targetUserId: input.targetUserId }),
      };

      const logs = await ctx.db.activityLog.findMany({
        where,
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          targetUser: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      let nextCursor: string | undefined = undefined;
      if (logs.length > limit) {
        const nextItem = logs.pop();
        nextCursor = nextItem?.id;
      }

      return {
        logs: logs.map((log) => ({
          ...log,
          details: log.details ? JSON.parse(log.details) : null,
        })),
        nextCursor,
      };
    }),

  getByUser: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const limit = input.limit;
      const cursor = input.cursor;

      const logs = await ctx.db.activityLog.findMany({
        where: {
          OR: [
            { userId: input.userId },
            { targetUserId: input.userId },
          ],
        },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          targetUser: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      let nextCursor: string | undefined = undefined;
      if (logs.length > limit) {
        const nextItem = logs.pop();
        nextCursor = nextItem?.id;
      }

      return {
        logs: logs.map((log) => ({
          ...log,
          details: log.details ? JSON.parse(log.details) : null,
        })),
        nextCursor,
      };
    }),

  getStats: adminProcedure.query(async ({ ctx }) => {
    const totalLogs = await ctx.db.activityLog.count();
    
    const logsByType = await ctx.db.activityLog.groupBy({
      by: ["type"],
      _count: true,
    });

    const recentActivity = await ctx.db.activityLog.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    return {
      totalLogs,
      logsByType: logsByType.map((item) => ({
        type: item.type,
        count: item._count,
      })),
      recentActivity,
    };
  }),
});
