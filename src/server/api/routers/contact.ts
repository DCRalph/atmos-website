import { z } from "zod";
import { createTRPCRouter, publicProcedure, adminProcedure } from "~/server/api/trpc";

export const contactRouter = createTRPCRouter({
  getAll: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.contactSubmission.findMany({
      orderBy: { createdAt: "desc" },
    });
  }),

  getById: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.contactSubmission.findUnique({
        where: { id: input.id },
      });
    }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        subject: z.string().min(1),
        message: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.contactSubmission.create({
        data: input,
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.contactSubmission.delete({
        where: { id: input.id },
      });
    }),
});

