import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

const priceString = z
  .string()
  .regex(/^\d+(?:\.\d{1,2})?$/, "Invalid price format");

function parsePriceToCents(price: string): number {
  const [whole, frac = "0"] = price.split(".");
  const normalized = `${whole}.${frac.padEnd(2, "0").slice(0, 2)}`;
  return Math.round(parseFloat(normalized) * 100);
}

export const merchRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ activeOnly: z.boolean().default(true) }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.merchItem.findMany({
        where: input?.activeOnly ? { active: true } : undefined,
        orderBy: { createdAt: "desc" },
      });
    }),

  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().min(1),
        price: priceString,
        imageUrl: z.string().url().optional(),
        active: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { price, ...rest } = input;
      return ctx.db.merchItem.create({ data: { ...rest, priceCents: parsePriceToCents(price) } });
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        price: priceString.optional(),
        imageUrl: z.string().url().nullable().optional(),
        active: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, price, ...data } = input;
      return ctx.db.merchItem.update({ where: { id }, data: { ...data, priceCents: price ? parsePriceToCents(price) : undefined } });
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.merchItem.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
