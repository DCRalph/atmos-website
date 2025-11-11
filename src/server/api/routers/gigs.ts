import { z } from "zod";
import { createTRPCRouter, publicProcedure, adminProcedure } from "~/server/api/trpc";
import { getTodayRangeStart, getTodayRangeEnd, isGigUpcoming } from "~/lib/date-utils";

export const gigsRouter = createTRPCRouter({
  getAll: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const search = input?.search?.toLowerCase().trim();
      
      const where = search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              { subtitle: { contains: search, mode: "insensitive" as const } },
              { description: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : undefined;

      return ctx.db.gig.findMany({
        where,
        orderBy: { gigStartTime: "desc" },
        include: {
          media: {
            orderBy: [
              { featured: "desc" },
              { createdAt: "asc" }
            ]
          }
        },
      });
    }),

  getUpcoming: publicProcedure.query(async ({ ctx }) => {
    const allGigs = await ctx.db.gig.findMany({
      orderBy: { gigStartTime: "asc" },
      include: {
        media: {
          orderBy: [
            { featured: "desc" },
            { createdAt: "asc" }
          ]
        }
      },
    });
    // Filter to only upcoming gigs
    return allGigs.filter((gig) => isGigUpcoming(gig));
  }),

  getPast: publicProcedure.query(async ({ ctx }) => {
    const allGigs = await ctx.db.gig.findMany({
      orderBy: { gigStartTime: "desc" },
      include: {
        media: {
          orderBy: [
            { featured: "desc" },
            { createdAt: "asc" }
          ]
        }
      },
    });
    // Filter to only past gigs
    return allGigs.filter((gig) => !isGigUpcoming(gig));
  }),

  getToday: publicProcedure.query(async ({ ctx }) => {
    // Use UTC time for all comparisons
    const startDate = getTodayRangeStart();
    const endDate = getTodayRangeEnd();

    const todayGigs = await ctx.db.gig.findMany({
      where: {
        gigStartTime: {
          gte: startDate,
          lt: endDate,
        },
      },
      orderBy: { gigStartTime: "asc" },
      include: {
        media: {
          orderBy: [
            { featured: "desc" },
            { createdAt: "asc" }
          ]
        }
      },
    });

    // Filter to only upcoming gigs (gigs that haven't ended yet)
    return todayGigs.filter((gig) => isGigUpcoming(gig));
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.gig.findUnique({
        where: { id: input.id },
        include: {
          media: {
            orderBy: [
              { featured: "desc" },
              { createdAt: "asc" }
            ]
          }
        },
      });
    }),

  create: adminProcedure
    .input(
      z.object({
        title: z.string().min(1),
        subtitle: z.string().min(1),
        description: z.string().optional(),
        gigStartTime: z.date(),
        gigEndTime: z.date().optional(),
        ticketLink: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.gig.create({
        data: input,
      });
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        subtitle: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        gigStartTime: z.date().optional(),
        gigEndTime: z.date().optional().nullable(),
        ticketLink: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.gig.update({
        where: { id },
        data,
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.gig.delete({
        where: { id: input.id },
      });
    }),

  // Media management endpoints
  addMedia: adminProcedure
    .input(
      z.object({
        gigId: z.string(),
        type: z.enum(["photo", "video"]),
        url: z.string().url(),
        featured: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.gigMedia.create({
        data: input,
      });
    }),

  updateMedia: adminProcedure
    .input(
      z.object({
        id: z.string(),
        type: z.enum(["photo", "video"]).optional(),
        url: z.string().url().optional(),
        featured: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.gigMedia.update({
        where: { id },
        data,
      });
    }),

  deleteMedia: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.gigMedia.delete({
        where: { id: input.id },
      });
    }),
});

