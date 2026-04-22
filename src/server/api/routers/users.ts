import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { logUserActivity } from "~/server/utils/activity-log";
import { addUserRole, removeUserRole } from "~/server/utils/roles";
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
          roles: { select: { role: true } },
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

          return {
            ...user,
            lastLoginMethod,
            lastLoginAt,
          };
        }),
      );

      return usersWithLastLogin;
    }),

  addRole: adminProcedure
    .input(
      z.object({
        id: z.string(),
        role: z.enum(["USER", "CREATOR", "ADMIN"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const targetUser = await ctx.db.user.findUnique({
        where: { id: input.id },
        select: { name: true, email: true },
      });

      await addUserRole(input.id, input.role, {
        createdBy: ctx.session.user.id,
      });

      await logUserActivity(
        ActivityType.USER_ROLE_ADDED,
        `Added role ${input.role} to ${targetUser?.name ?? targetUser?.email ?? input.id}`,
        ctx.session.user.id,
        input.id,
        { role: input.role },
      );

      return { ok: true as const };
    }),

  removeRole: adminProcedure
    .input(
      z.object({
        id: z.string(),
        role: z.enum(["USER", "CREATOR", "ADMIN"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.session.user.id && input.role === "ADMIN") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot remove your own admin role",
        });
      }

      const targetUser = await ctx.db.user.findUnique({
        where: { id: input.id },
        select: { name: true, email: true },
      });

      await removeUserRole(input.id, input.role);

      await logUserActivity(
        ActivityType.USER_ROLE_REMOVED,
        `Removed role ${input.role} from ${targetUser?.name ?? targetUser?.email ?? input.id}`,
        ctx.session.user.id,
        input.id,
        { role: input.role },
      );

      return { ok: true as const };
    }),

  setRoles: adminProcedure
    .input(
      z.object({
        id: z.string(),
        roles: z.array(z.enum(["USER", "CREATOR", "ADMIN"])),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (
        input.id === ctx.session.user.id &&
        !input.roles.includes("ADMIN")
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot remove your own admin role",
        });
      }

      const current = await ctx.db.userRoleAssignment.findMany({
        where: { userId: input.id },
        select: { role: true },
      });
      const currentSet = new Set(current.map((c) => c.role));
      const nextSet = new Set(input.roles);

      for (const role of nextSet) {
        if (!currentSet.has(role)) {
          await addUserRole(input.id, role, {
            createdBy: ctx.session.user.id,
          });
        }
      }
      for (const role of currentSet) {
        if (!nextSet.has(role)) {
          await removeUserRole(input.id, role);
        }
      }

      await logUserActivity(
        ActivityType.USER_ROLE_CHANGED,
        `Updated roles for ${input.id}`,
        ctx.session.user.id,
        input.id,
        { roles: input.roles },
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
          roles: { select: { role: true } },
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

      return {
        ...user,
        lastLoginMethod,
        lastLoginAt,
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
