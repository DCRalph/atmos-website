import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { auth } from "~/server/auth";
import { headers } from "next/headers";
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
        },
      });

      // Fetch last login method for each user
      // Note: Better Auth plugin tables may not exist yet, so we handle errors gracefully
      const usersWithLastLogin = await Promise.all(
        users.map(async (user) => {
          let lastLoginMethod = null;
          let lastLoginAt = null;
          let banned = false;
          let bannedReason = null;
          let bannedAt = null;

          try {
            // Try to get last login method from Better Auth (table may not exist yet)
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

            // Try to check if user is banned (table may not exist yet)
            // @ts-expect-error - Better Auth plugin table, may not exist in Prisma types yet
            const bannedUser = await ctx.db.bannedUser?.findUnique({
              where: { userId: user.id },
              select: {
                reason: true,
                bannedAt: true,
              },
            }).catch(() => null);

            if (bannedUser) {
              banned = true;
              bannedReason = bannedUser.reason ?? null;
              bannedAt = bannedUser.bannedAt ?? null;
            }
          } catch {
            // Tables don't exist yet, use defaults
          }

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

      // Get last login method
      // Note: Better Auth plugin tables may not exist yet, so we handle errors gracefully
      let lastLoginMethod = null;
      let lastLoginAt = null;
      let banned = false;
      let bannedReason = null;
      let bannedAt = null;

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

        // @ts-expect-error - Better Auth plugin table, may not exist in Prisma types yet
        const bannedUser = await ctx.db.bannedUser?.findUnique({
          where: { userId: user.id },
          select: {
            reason: true,
            bannedAt: true,
          },
        }).catch(() => null);

        if (bannedUser) {
          banned = true;
          bannedReason = bannedUser.reason ?? null;
          bannedAt = bannedUser.bannedAt ?? null;
        }
      } catch {
        // Tables might not exist yet
      }

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
      // Prevent admins from banning themselves
      if (input.id === ctx.session.user.id) {
        throw new Error("You cannot ban your own account");
      }

      // Get user info for logging
      const targetUser = await ctx.db.user.findUnique({
        where: { id: input.id },
        select: { name: true, email: true },
      });

      // Use Better Auth admin API to ban user (with type assertion)
      const headersList = await headers();
      
      // @ts-expect-error - Better Auth admin API types may not be fully available
      const result = await auth.api.admin?.banUser({
        userId: input.id,
        reason: input.reason,
        headers: headersList,
      }).catch(async () => {
        // Fallback: create banned user record directly if API not available
        // @ts-expect-error - Better Auth plugin table, may not exist in Prisma types yet
        return await ctx.db.bannedUser?.create({
          data: {
            userId: input.id,
            reason: input.reason ?? null,
            bannedAt: new Date(),
          },
        }).catch(() => null);
      });

      // Log the activity
      await logUserActivity(
        ActivityType.USER_BANNED,
        `Banned user ${targetUser?.name ?? targetUser?.email ?? input.id}${input.reason ? `: ${input.reason}` : ""}`,
        ctx.session.user.id,
        input.id,
        {
          reason: input.reason,
          bannedUser: targetUser?.name ?? targetUser?.email ?? input.id,
        },
      );

      return result;
    }),

  unban: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Get user info for logging
      const targetUser = await ctx.db.user.findUnique({
        where: { id: input.id },
        select: { name: true, email: true },
      });

      const headersList = await headers();
      
      // Use Better Auth admin API to unban user (with type assertion)
      // @ts-expect-error - Better Auth admin API types may not be fully available
      const result = await auth.api.admin?.unbanUser({
        userId: input.id,
        headers: headersList,
      }).catch(async () => {
        // Fallback: delete banned user record directly if API not available
        // @ts-expect-error - Better Auth plugin table, may not exist in Prisma types yet
        return await ctx.db.bannedUser?.delete({
          where: { userId: input.id },
        }).catch(() => null);
      });

      // Log the activity
      await logUserActivity(
        ActivityType.USER_UNBANNED,
        `Unbanned user ${targetUser?.name ?? targetUser?.email ?? input.id}`,
        ctx.session.user.id,
        input.id,
        {
          unbannedUser: targetUser?.name ?? targetUser?.email ?? input.id,
        },
      );

      return result;
    }),

  impersonate: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Prevent admins from impersonating themselves
      if (input.id === ctx.session.user.id) {
        throw new Error("You cannot impersonate yourself");
      }

      // Get user info for logging
      const targetUser = await ctx.db.user.findUnique({
        where: { id: input.id },
        select: { name: true, email: true },
      });

      const headersList = await headers();
      
      // Use Better Auth admin API to impersonate user (with type assertion)
      // @ts-expect-error - Better Auth admin API types may not be fully available
      const result = await auth.api.admin?.impersonateUser({
        userId: input.id,
        headers: headersList,
      });

      // Log the activity
      await logUserActivity(
        ActivityType.USER_IMPERSONATED,
        `Impersonated user ${targetUser?.name ?? targetUser?.email ?? input.id}`,
        ctx.session.user.id,
        input.id,
        {
          impersonatedUser: targetUser?.name ?? targetUser?.email ?? input.id,
        },
      );

      return result;
    }),
});
