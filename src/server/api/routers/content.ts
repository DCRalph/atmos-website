import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

const contentTypeEnum = z.enum(["MIX", "VIDEO", "PLAYLIST"]);
const dateString = z.string().min(1);

export const contentRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ type: contentTypeEnum.optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.contentItem.findMany({
        where: input?.type ? { type: input.type } : undefined,
        orderBy: { date: "desc" },
      });
    }),

  getFeatured: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.contentItem.findFirst({
      where: { featured: true },
      orderBy: { date: "desc" },
    });
  }),

  create: publicProcedure
    .input(
      z.object({
        type: contentTypeEnum,
        title: z.string().min(1),
        description: z.string().min(1),
        date: dateString,
        link: z.string().min(1),
        featured: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { date, ...rest } = input;
      return ctx.db.contentItem.create({
        data: { ...rest, date: new Date(date) },
      });
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        type: contentTypeEnum.optional(),
        title: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        date: dateString.optional(),
        link: z.string().min(1).optional(),
        featured: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, date, ...rest } = input;
      return ctx.db.contentItem.update({
        where: { id },
        data: { ...rest, date: date ? new Date(date) : undefined },
      });
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.contentItem.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
