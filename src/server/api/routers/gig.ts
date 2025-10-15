import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

const dateString = z.string().min(1);

export const gigRouter = createTRPCRouter({
  listAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.gig.findMany({ orderBy: { date: "desc" } });
  }),

  listUpcoming: publicProcedure.query(async ({ ctx }) => {
    const now = new Date();
    return ctx.db.gig.findMany({
      where: { date: { gte: now } },
      orderBy: { date: "asc" },
    });
  }),

  listPast: publicProcedure.query(async ({ ctx }) => {
    const now = new Date();
    return ctx.db.gig.findMany({
      where: { date: { lt: now } },
      orderBy: { date: "desc" },
    });
  }),

  create: publicProcedure
    .input(
      z.object({
        date: dateString,
        venue: z.string().min(1),
        city: z.string().min(1),
        time: z.string().min(1),
        ticketLink: z.string().url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.gig.create({
        data: {
          date: new Date(input.date),
          venue: input.venue,
          city: input.city,
          time: input.time,
          ticketLink: input.ticketLink,
        },
      });
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        date: dateString.optional(),
        venue: z.string().min(1).optional(),
        city: z.string().min(1).optional(),
        time: z.string().min(1).optional(),
        ticketLink: z.string().url().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, date, ...rest } = input;
      return ctx.db.gig.update({
        where: { id },
        data: {
          ...rest,
          date: date ? new Date(date) : undefined,
        },
      });
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.gig.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
