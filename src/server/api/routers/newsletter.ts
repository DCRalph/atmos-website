import { z } from "zod";
import { createTRPCRouter, publicProcedure, adminProcedure } from "~/server/api/trpc";

export const newsletterRouter = createTRPCRouter({
  subscribe: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const email = input.email.toLowerCase().trim();

      const existing = await ctx.db.newsletterSubscription.findUnique({
        where: { email },
      });

      if (existing) {
        if (existing.removed) {
          const revived = await ctx.db.newsletterSubscription.update({
            where: { email },
            data: { removed: false },
          });
          return { created: true, subscription: revived };
        }

        return { created: false, subscription: existing };
      }

      const created = await ctx.db.newsletterSubscription.create({
        data: { email, removed: false },
      });

      return { created: true, subscription: created };
    }),

  getAll: adminProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          includeRemoved: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const search = input?.search?.toLowerCase().trim();
      const includeRemoved = input?.includeRemoved ?? false;

      const where: {
        removed?: boolean;
        email?: { contains: string; mode: "insensitive" };
      } = {};

      if (!includeRemoved) {
        where.removed = false;
      }

      if (search) {
        where.email = { contains: search, mode: "insensitive" };
      }

      return ctx.db.newsletterSubscription.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.newsletterSubscription.update({
        where: { id: input.id },
        data: { removed: true },
      });
    }),

  toggleRemoved: adminProcedure
    .input(z.object({ id: z.string(), removed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.newsletterSubscription.update({
        where: { id: input.id },
        data: { removed: input.removed },
      });
    }),
});
