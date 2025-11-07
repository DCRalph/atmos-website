import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";

export const usersRouter = createTRPCRouter({
  getAll: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }),

  updateRole: adminProcedure
    .input(
      z.object({
        id: z.string(),
        role: z.enum(["USER", "CREATOR", "ADMIN"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Prevent admins from removing their own admin role
      if (input.id === ctx.session.user.id && input.role !== "ADMIN") {
        throw new Error("You cannot remove your own admin role");
      }

      return ctx.db.user.update({
        where: { id: input.id },
        data: { role: input.role },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Prevent admins from deleting themselves
      if (input.id === ctx.session.user.id) {
        throw new Error("You cannot delete your own account");
      }

      return ctx.db.user.delete({
        where: { id: input.id },
      });
    }),
});

