import { z } from "zod";
import { createTRPCRouter, publicProcedure, adminProcedure } from "~/server/api/trpc";

export const crewRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.crewMember.findMany({
      orderBy: { createdAt: "asc" },
    });
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.crewMember.findUnique({
        where: { id: input.id },
      });
    }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        role: z.string().min(1),
        instagram: z.string().optional(),
        soundcloud: z.string().optional(),
        image: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.crewMember.create({
        data: input,
      });
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        role: z.string().min(1).optional(),
        instagram: z.string().optional().nullable(),
        soundcloud: z.string().optional().nullable(),
        image: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.crewMember.update({
        where: { id },
        data,
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.crewMember.delete({
        where: { id: input.id },
      });
    }),
});

