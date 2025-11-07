import { z } from "zod";
import { createTRPCRouter, publicProcedure, adminProcedure } from "~/server/api/trpc";

export const gigsRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.gig.findMany({
      orderBy: { date: "desc" },
    });
  }),

  getUpcoming: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.gig.findMany({
      where: { isUpcoming: true },
      orderBy: { date: "asc" },
    });
  }),

  getPast: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.gig.findMany({
      where: { isUpcoming: false },
      orderBy: { date: "desc" },
    });
  }),

  getToday: publicProcedure.query(async ({ ctx }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return ctx.db.gig.findMany({
      where: {
        date: {
          gte: today,
          lt: tomorrow,
        },
        isUpcoming: true,
      },
      orderBy: { date: "asc" },
    });
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.gig.findUnique({
        where: { id: input.id },
      });
    }),

  create: adminProcedure
    .input(
      z.object({
        date: z.date(),
        title: z.string().min(1),
        subtitle: z.string().min(1),
        time: z.string().optional(),
        ticketLink: z.string().optional(),
        isUpcoming: z.boolean().default(true),
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
        date: z.date().optional(),
        title: z.string().min(1).optional(),
        subtitle: z.string().min(1).optional(),
        time: z.string().optional().nullable(),
        ticketLink: z.string().optional().nullable(),
        isUpcoming: z.boolean().optional(),
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
});

