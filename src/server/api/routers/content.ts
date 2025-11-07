import { z } from "zod";
import { createTRPCRouter, publicProcedure, adminProcedure } from "~/server/api/trpc";

export const contentRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.contentItem.findMany({
      orderBy: { date: "desc" },
    });
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.contentItem.findUnique({
        where: { id: input.id },
      });
    }),

  create: adminProcedure
    .input(
      z.object({
        type: z.string().min(1),
        title: z.string().min(1),
        description: z.string().min(1),
        date: z.date(),
        link: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.contentItem.create({
        data: input,
      });
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        type: z.string().min(1).optional(),
        title: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        date: z.date().optional(),
        link: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.contentItem.update({
        where: { id },
        data,
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.contentItem.delete({
        where: { id: input.id },
      });
    }),
});

