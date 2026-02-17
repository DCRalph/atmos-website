import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";

export const settingsRouter = createTRPCRouter({
  getAll: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.keyValueStore.findMany({
      orderBy: { key: "asc" },
    });
  }),

  getByKey: adminProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.keyValueStore.findUnique({
        where: { key: input.key },
      });
    }),

  upsert: adminProcedure
    .input(
      z.object({
        key: z.string().min(1),
        value: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.keyValueStore.upsert({
        where: { key: input.key },
        update: { value: input.value },
        create: { key: input.key, value: input.value },
      });
    }),

  delete: adminProcedure
    .input(z.object({ key: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.keyValueStore.delete({
        where: { key: input.key },
      });
    }),
});
