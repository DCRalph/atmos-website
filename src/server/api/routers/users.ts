import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { env } from "~/env";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { logUserActivity } from "~/server/utils/activity-log";
import {
  ADMIN_TIER,
  grantUserPermission,
  isAdminTier,
  revokeUserPermission,
  userHasPermission,
  type UserWithPermissions,
} from "~/server/utils/permissions";
import {
  listActiveSessions,
  listSignInMethods,
  overwritePassword,
  passwordSchema,
  removeSignInMethod,
} from "~/server/sign-in-methods";
import { ActivityType, type UserPermission } from "~Prisma/client";

/**
 * When somebody last signed in, and how.
 *
 * Better Auth's `lastLoginMethod` plugin owns this table and it is not in our
 * Prisma schema, so the delegate is reached dynamically and may simply not be
 * there. Narrowed to a real type here rather than left as `any`: the admin
 * renders both fields, and an untyped value meant a wrong shape would only show
 * up as a broken cell.
 */
type LastLogin = { method: string | null; updatedAt: Date | null };

async function readLastLogin(
  db: unknown,
  userId: string,
): Promise<LastLogin | null> {
  const delegate = (
    db as {
      lastLoginMethod?: {
        findUnique: (args: unknown) => Promise<LastLogin | null>;
      };
    }
  ).lastLoginMethod;
  if (!delegate) return null;

  try {
    return await delegate
      .findUnique({
        where: { userId },
        select: { method: true, updatedAt: true },
      })
      .catch(() => null);
  } catch {
    return null;
  }
}

const permissionSchema = z.enum([
  "EVENT_ORGANISER",
  "ARTIST",
  "ADMIN",
  "SUPERADMIN",
]) satisfies z.ZodType<UserPermission>;

const userInput = z.object({ id: z.string() });

/**
 * Loads a user the caller is about to read or change in detail, refusing when
 * they are an admin or superadmin and the caller is not a superadmin. Admins
 * can see that other admins exist; only superadmins see or touch their
 * sign-in methods, sessions, and passwords.
 */
async function loadManageableUser(actor: UserWithPermissions, id: string) {
  const target = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      permissions: { select: { permission: true } },
    },
  });
  if (!target) {
    throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  }
  if (!canManage(actor, target)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only superadmins can manage admin accounts",
    });
  }
  return target;
}

function canManage(
  actor: UserWithPermissions,
  target: { permissions: { permission: UserPermission }[] },
) {
  return (
    userHasPermission(actor, "SUPERADMIN") ||
    !isAdminTier(target.permissions.map((row) => row.permission))
  );
}

function describe(user: { name: string; email: string }) {
  return user.name || user.email;
}

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

      return await Promise.all(
        users.map(async (user) => {
          const lastLogin = await readLastLogin(ctx.db, user.id);
          return {
            ...user,
            lastLoginMethod: lastLogin?.method ?? null,
            lastLoginAt: lastLogin?.updatedAt ?? null,
          };
        }),
      );
    }),

  /**
   * One user. Admin accounts come back without sign-in methods or sessions
   * unless the caller is a superadmin; `canManage` says which shape it is.
   */
  getById: adminProcedure.input(userInput).query(async ({ ctx, input }) => {
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
      },
    });

    if (!user) {
      return null;
    }

    const lastLogin = await readLastLogin(ctx.db, user.id);
    const base = {
      ...user,
      isSelf: user.id === ctx.session.user.id,
      viewerIsSuperadmin: userHasPermission(ctx.user, "SUPERADMIN"),
      lastLoginMethod: lastLogin?.method ?? null,
      lastLoginAt: lastLogin?.updatedAt ?? null,
    };

    if (!canManage(ctx.user, user)) {
      return { ...base, canManage: false as const };
    }

    const [signIn, sessions] = await Promise.all([
      listSignInMethods(user.id),
      listActiveSessions(user.id),
    ]);
    return { ...base, canManage: true as const, ...signIn, sessions };
  }),

  /**
   * Replaces a user's permissions. Only superadmins may grant or revoke ADMIN
   * or SUPERADMIN, SUPERADMIN always brings ADMIN with it, and nobody can take
   * their own admin access away, which also keeps at least one superadmin.
   */
  setPermissions: adminProcedure
    .input(
      z.object({
        id: z.string(),
        permissions: z.array(permissionSchema),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const target = await loadManageableUser(ctx.user, input.id);

      const currentSet = new Set(target.permissions.map((c) => c.permission));
      const nextSet = new Set(input.permissions);
      if (nextSet.has("SUPERADMIN")) nextSet.add("ADMIN");

      const changesAdminTier = ADMIN_TIER.some(
        (permission) => currentSet.has(permission) !== nextSet.has(permission),
      );
      if (changesAdminTier && !userHasPermission(ctx.user, "SUPERADMIN")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only superadmins can grant or remove admin access",
        });
      }

      if (input.id === ctx.session.user.id) {
        const lost = ADMIN_TIER.find(
          (permission) =>
            currentSet.has(permission) && !nextSet.has(permission),
        );
        if (lost) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `You cannot remove your own ${lost.toLowerCase()} permission`,
          });
        }
      }

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
        `Updated permissions for ${describe(target)}`,
        ctx.session.user.id,
        input.id,
        { permissions: [...nextSet] },
      );

      return { ok: true as const };
    }),

  /**
   * Sets a new password without the old one, adding password sign-in if the
   * user only had social accounts. Signs them out everywhere by default, since
   * the usual reason is a compromised or forgotten password.
   */
  setPassword: adminProcedure
    .input(
      z.object({
        id: z.string(),
        password: passwordSchema,
        revokeSessions: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const target = await loadManageableUser(ctx.user, input.id);

      await overwritePassword(target.id, input.password);
      if (input.revokeSessions) {
        await ctx.db.session.deleteMany({ where: { userId: target.id } });
      }

      await logUserActivity(
        ActivityType.USER_UPDATED,
        `Set a new password for ${describe(target)}`,
        ctx.session.user.id,
        target.id,
        { revokedSessions: input.revokeSessions },
      );

      return { ok: true as const };
    }),

  /** Emails the user a password reset link, the same one "forgot password" sends. */
  sendPasswordReset: adminProcedure
    .input(userInput)
    .mutation(async ({ ctx, input }) => {
      const target = await loadManageableUser(ctx.user, input.id);

      await auth.api.requestPasswordReset({
        body: {
          email: target.email,
          redirectTo: `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/reset-password`,
        },
      });

      await logUserActivity(
        ActivityType.USER_UPDATED,
        `Sent a password reset email to ${describe(target)}`,
        ctx.session.user.id,
        target.id,
      );

      return { ok: true as const, sentTo: target.email };
    }),

  setEmailVerified: adminProcedure
    .input(z.object({ id: z.string(), verified: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const target = await loadManageableUser(ctx.user, input.id);

      await ctx.db.user.update({
        where: { id: target.id },
        data: { emailVerified: input.verified },
      });

      await logUserActivity(
        ActivityType.USER_UPDATED,
        `Marked ${describe(target)}'s email as ${input.verified ? "verified" : "unverified"}`,
        ctx.session.user.id,
        target.id,
        { emailVerified: input.verified },
      );

      return { ok: true as const };
    }),

  /** Removes a social account or the password. The last sign-in method stays. */
  unlinkAccount: adminProcedure
    .input(z.object({ id: z.string(), accountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const target = await loadManageableUser(ctx.user, input.id);
      const removed = await removeSignInMethod(target.id, input.accountId);

      await logUserActivity(
        ActivityType.USER_UPDATED,
        `Removed ${removed.providerId} sign-in from ${describe(target)}`,
        ctx.session.user.id,
        target.id,
        { providerId: removed.providerId },
      );

      return { ok: true as const };
    }),

  revokeSession: adminProcedure
    .input(z.object({ id: z.string(), sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const target = await loadManageableUser(ctx.user, input.id);

      await ctx.db.session.deleteMany({
        where: { id: input.sessionId, userId: target.id },
      });

      await logUserActivity(
        ActivityType.USER_UPDATED,
        `Signed ${describe(target)} out of one session`,
        ctx.session.user.id,
        target.id,
      );

      return { ok: true as const };
    }),

  revokeSessions: adminProcedure
    .input(userInput)
    .mutation(async ({ ctx, input }) => {
      const target = await loadManageableUser(ctx.user, input.id);

      const { count } = await ctx.db.session.deleteMany({
        where: { userId: target.id },
      });

      await logUserActivity(
        ActivityType.USER_UPDATED,
        `Signed ${describe(target)} out everywhere`,
        ctx.session.user.id,
        target.id,
        { sessions: count },
      );

      return { ok: true as const, count };
    }),

  delete: adminProcedure.input(userInput).mutation(async ({ ctx, input }) => {
    if (input.id === ctx.session.user.id) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You cannot delete your own account",
      });
    }

    const target = await loadManageableUser(ctx.user, input.id);

    // Better Auth's sessions and accounts cascade with the user row.
    await ctx.db.user.delete({ where: { id: target.id } });

    await logUserActivity(
      ActivityType.USER_DELETED,
      `Deleted user ${describe(target)}`,
      ctx.session.user.id,
      input.id,
      { deletedUser: describe(target) },
    );

    return { ok: true as const };
  }),
});
