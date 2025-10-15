import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const crewRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.crewMember.findMany({ orderBy: { name: "asc" } });
  }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        role: z.string().min(1),
        bio: z.string().min(1),
        instagram: z.string().url().optional(),
        soundcloud: z.string().url().optional(),
        photoUrl: z.string().url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.crewMember.create({ data: input });
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        role: z.string().min(1).optional(),
        bio: z.string().min(1).optional(),
        instagram: z.string().url().nullable().optional(),
        soundcloud: z.string().url().nullable().optional(),
        photoUrl: z.string().url().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.crewMember.update({ where: { id }, data });
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.crewMember.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
