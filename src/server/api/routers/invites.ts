import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";

export const invitesRouter = createTRPCRouter({
  getAll: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const search = input?.search?.toLowerCase().trim();
      
      const where = search
        ? {
            email: { contains: search, mode: "insensitive" as const },
          }
        : undefined;

      return ctx.db.invite.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });
    }),

  create: adminProcedure
    .input(
      z.object({
        email: z.string().email(),
        role: z.enum(["USER", "CREATOR", "ADMIN"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if invite already exists
      const existingInvite = await ctx.db.invite.findUnique({
        where: { email: input.email },
      });

      if (existingInvite && !existingInvite.used) {
        throw new Error("An active invite already exists for this email");
      }

      // Check if user already exists
      const existingUser = await ctx.db.user.findUnique({
        where: { email: input.email },
      });

      if (existingUser) {
        throw new Error("A user with this email already exists");
      }

      return ctx.db.invite.create({
        data: {
          email: input.email,
          role: input.role,
          createdBy: ctx.session.user.id,
        },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.invite.delete({
        where: { id: input.id },
      });
    }),

  resend: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invite = await ctx.db.invite.findUnique({
        where: { id: input.id },
      });

      if (!invite) {
        throw new Error("Invite not found");
      }

      if (invite.used) {
        throw new Error("Cannot resend a used invite");
      }

      // For now, just return the invite
      // In the future, you could send an email here
      return invite;
    }),
});

