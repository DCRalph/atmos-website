import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { logUserActivity } from "~/server/utils/activity-log";
import {
  grantUserPermission,
  isPermissionCutoverComplete,
  revokeUserPermission,
} from "~/server/utils/permissions";
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
          permissions: { select: { permission: true } },
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

          try {
            // @ts-expect-error - Better Auth plugin table, may not exist in Prisma types yet
            const lastLogin = await ctx.db.lastLoginMethod
              ?.findUnique({
                where: { userId: user.id },
                select: {
                  method: true,
                  updatedAt: true,
                },
              })
              .catch(() => null);

            if (lastLogin) {
              lastLoginMethod = lastLogin.method ?? null;
              lastLoginAt = lastLogin.updatedAt ?? null;
            }
          } catch {
            // Table may not exist yet
          }

          return {
            ...user,
            lastLoginMethod,
            lastLoginAt,
          };
        }),
      );

      return usersWithLastLogin;
    }),

  addPermission: adminProcedure
    .input(
      z.object({
        id: z.string(),
        permission: z.enum(["EVENT_ORGANISER", "CREATOR", "ADMIN"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const targetUser = await ctx.db.user.findUnique({
        where: { id: input.id },
        select: { name: true, email: true },
      });

      await grantUserPermission(input.id, input.permission, {
        createdBy: ctx.session.user.id,
      });

      await logUserActivity(
        ActivityType.USER_PERMISSION_ADDED,
        `Added permission ${input.permission} to ${targetUser?.name ?? targetUser?.email ?? input.id}`,
        ctx.session.user.id,
        input.id,
        { permission: input.permission },
      );

      return { ok: true as const };
    }),

  removePermission: adminProcedure
    .input(
      z.object({
        id: z.string(),
        permission: z.enum(["EVENT_ORGANISER", "CREATOR", "ADMIN"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.session.user.id && input.permission === "ADMIN") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot remove your own admin permission",
        });
      }

      const targetUser = await ctx.db.user.findUnique({
        where: { id: input.id },
        select: { name: true, email: true },
      });

      await revokeUserPermission(input.id, input.permission);

      await logUserActivity(
        ActivityType.USER_PERMISSION_REMOVED,
        `Removed permission ${input.permission} from ${targetUser?.name ?? targetUser?.email ?? input.id}`,
        ctx.session.user.id,
        input.id,
        { permission: input.permission },
      );

      return { ok: true as const };
    }),

  setPermissions: adminProcedure
    .input(
      z.object({
        id: z.string(),
        permissions: z.array(z.enum(["EVENT_ORGANISER", "CREATOR", "ADMIN"])),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (
        input.id === ctx.session.user.id &&
        !input.permissions.includes("ADMIN")
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot remove your own admin permission",
        });
      }

      const current = await ctx.db.userPermissionAssignment.findMany({
        where: { userId: input.id },
        select: { permission: true },
      });
      const currentSet = new Set(current.map((c) => c.permission));
      const nextSet = new Set(input.permissions);

      for (const permission of nextSet) {
        if (!currentSet.has(permission)) {
          await grantUserPermission(input.id, permission, {
            createdBy: ctx.session.user.id,
          });
        }
      }
      for (const permission of currentSet) {
        if (!nextSet.has(permission)) {
          await revokeUserPermission(input.id, permission);
        }
      }

      await logUserActivity(
        ActivityType.USER_PERMISSION_CHANGED,
        `Updated permissions for ${input.id}`,
        ctx.session.user.id,
        input.id,
        { permissions: input.permissions },
      );

      return { ok: true as const };
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
          permissions: { select: { permission: true } },
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

      let lastLoginMethod = null;
      let lastLoginAt = null;

      try {
        // @ts-expect-error - Better Auth plugin table, may not exist in Prisma types yet
        const lastLogin = await ctx.db.lastLoginMethod
          ?.findUnique({
            where: { userId: user.id },
            select: {
              method: true,
              updatedAt: true,
            },
          })
          .catch(() => null);

        if (lastLogin) {
          lastLoginMethod = lastLogin.method ?? null;
          lastLoginAt = lastLogin.updatedAt ?? null;
        }
      } catch {
        // Table might not exist yet
      }

      return {
        ...user,
        lastLoginMethod,
        lastLoginAt,
      };
    }),

  permissionMigrationStatus: adminProcedure.query(async ({ ctx }) => {
    const [cutoverComplete, assignedUsers, adminCount] = await Promise.all([
      isPermissionCutoverComplete(ctx.db),
      ctx.db.userPermissionAssignment.groupBy({ by: ["userId"] }),
      ctx.db.userPermissionAssignment.count({
        where: { permission: "ADMIN" },
      }),
    ]);

    return {
      cutoverComplete,
      assignedUserCount: assignedUsers.length,
      adminCount,
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
});
