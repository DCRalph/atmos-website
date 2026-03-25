import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { auth } from "~/server/auth";
import { logUserActivity, getRequestMetadata } from "~/server/utils/activity-log";
import { ActivityType } from "~Prisma/client";

export const usersRouter = createTRPCRouter({
  getAll: adminProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const search = input?.search?.toLowerCase().trim();

      const where = search
        ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
        : undefined;

      const users = await ctx.db.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
          image: true,
          banned: true,
          banReason: true,
          banExpires: true,
        },
      });

      // Fetch last login method for each user
      // Note: Better Auth plugin tables may not exist yet, so we handle errors gracefully
      const usersWithLastLogin = await Promise.all(
        users.map(async (user) => {
          let lastLoginMethod = null;
          let lastLoginAt = null;

          try {
            // @ts-expect-error - Better Auth plugin table, may not exist in Prisma types yet
            const lastLogin = await ctx.db.lastLoginMethod?.findUnique({
              where: { userId: user.id },
              select: {
                method: true,
                updatedAt: true,
              },
            }).catch(() => null);

            if (lastLogin) {
              lastLoginMethod = lastLogin.method ?? null;
              lastLoginAt = lastLogin.updatedAt ?? null;
            }
          } catch {
            // Table may not exist yet
          }

          const banned = Boolean(user.banned);
          const bannedReason = user.banReason ?? null;
          const bannedAt = null;

          return {
            ...user,
            lastLoginMethod,
            lastLoginAt,
            banned,
            bannedReason,
            bannedAt,
          };
        }),
      );

      return usersWithLastLogin;
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

      // Get current user role for logging
      const targetUser = await ctx.db.user.findUnique({
        where: { id: input.id },
        select: { role: true, name: true, email: true },
      });

      const result = await ctx.db.user.update({
        where: { id: input.id },
        data: { role: input.role },
      });

      // Log the activity
      const metadata = await getRequestMetadata();
      await logUserActivity(
        ActivityType.USER_ROLE_CHANGED,
        `Changed ${targetUser?.name ?? targetUser?.email ?? input.id}'s role from ${targetUser?.role ?? "unknown"} to ${input.role}`,
        ctx.session.user.id,
        input.id,
        {
          oldRole: targetUser?.role,
          newRole: input.role,
        },
      );

      return result;
    }),

  getById: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          emailVerified: true,
          image: true,
          createdAt: true,
          updatedAt: true,
          banned: true,
          banReason: true,
          banExpires: true,
          accounts: {
            select: {
              id: true,
              providerId: true,
              accountId: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!user) {
        return null;
      }

      let lastLoginMethod = null;
      let lastLoginAt = null;

      try {
        // @ts-expect-error - Better Auth plugin table, may not exist in Prisma types yet
        const lastLogin = await ctx.db.lastLoginMethod?.findUnique({
          where: { userId: user.id },
          select: {
            method: true,
            updatedAt: true,
          },
        }).catch(() => null);

        if (lastLogin) {
          lastLoginMethod = lastLogin.method ?? null;
          lastLoginAt = lastLogin.updatedAt ?? null;
        }
      } catch {
        // Table might not exist yet
      }

      const banned = Boolean(user.banned);
      const bannedReason = user.banReason ?? null;
      const bannedAt = null;

      return {
        ...user,
        lastLoginMethod,
        lastLoginAt,
        banned,
        bannedReason,
        bannedAt,
      };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Prevent admins from deleting themselves
      if (input.id === ctx.session.user.id) {
        throw new Error("You cannot delete your own account");
      }

      // Get user info for logging
      const targetUser = await ctx.db.user.findUnique({
        where: { id: input.id },
        select: { name: true, email: true },
      });

      // Delete user directly from database
      // Better Auth will handle cascading deletes for sessions and accounts
      const result = await ctx.db.user.delete({
        where: { id: input.id },
      });

      // Log the activity
      await logUserActivity(
        ActivityType.USER_DELETED,
        `Deleted user ${targetUser?.name ?? targetUser?.email ?? input.id}`,
        ctx.session.user.id,
        input.id,
        {
          deletedUser: targetUser?.name ?? targetUser?.email ?? input.id,
        },
      );

      return result;
    }),

  ban: adminProcedure
    .input(
      z.object({
        id: z.string(),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await auth.api.banUser({
        body: {
          userId: input.id,
          banReason: input.reason,
        },
        headers: ctx.headers,
      });

      await logUserActivity(
        ActivityType.USER_BANNED,
        `Banned user ${input.id}`,
        ctx.session.user.id,
        input.id,
        input.reason ? { reason: input.reason } : undefined,
      );

      return { ok: true as const };
    }),

  unban: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await auth.api.unbanUser({
        body: { userId: input.id },
        headers: ctx.headers,
      });

      await logUserActivity(
        ActivityType.USER_UNBANNED,
        `Unbanned user ${input.id}`,
        ctx.session.user.id,
        input.id,
      );

      return { ok: true as const };
    }),

  impersonate: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot impersonate yourself",
        });
      }
      if (!ctx.resHeaders) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impersonation requires browser request context",
        });
      }

      const result = await auth.api.impersonateUser({
        body: { userId: input.id },
        headers: ctx.headers,
        returnHeaders: true,
      });

      const cookies = result.headers.getSetCookie?.() ?? [];
      for (const cookie of cookies) {
        ctx.resHeaders.append("Set-Cookie", cookie);
      }

      await logUserActivity(
        ActivityType.USER_IMPERSONATED,
        `Started impersonating user ${input.id}`,
        ctx.session.user.id,
        input.id,
      );

      return { ok: true as const };
    }),
});
