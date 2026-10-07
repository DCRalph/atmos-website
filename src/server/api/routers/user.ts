import { TRPCError } from "@trpc/server";
import { isAPIError } from "better-auth/api";
import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { userHasPermission } from "~/server/utils/permissions";
import { auth } from "~/server/auth";
import { enforceRateLimit } from "~/server/ticketing/rate-limit";
import type { UserPermission } from "~Prisma/client";
import {
  listActiveSessions,
  listSignInMethods,
  passwordSchema,
  removeSignInMethod,
} from "~/server/sign-in-methods";

/**
 * Runs a better-auth endpoint, passing its refusal ("Invalid password", ...)
 * through as a 400 the client can show, instead of a generic 500.
 */
async function callAuth<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isAPIError(error)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
    }
    throw error;
  }
}

const ALL_PERMISSIONS: UserPermission[] = [
  "EVENT_ORGANISER",
  "ARTIST",
  "ADMIN",
  "SUPERADMIN",
];

export const userRouter = createTRPCRouter({
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.session?.user) {
      return null;
    }

    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      include: {
        permissions: { select: { permission: true } },
      },
    });

    if (!user) return null;

    const effectivePermissions = ALL_PERMISSIONS.filter((permission) =>
      userHasPermission(user, permission),
    );

    return { ...user, effectivePermissions };
  }),

  /**
   * Send another verification link to the signed-in user's own address.
   *
   * The address is taken from the session, never from input — accepting one
   * would turn this into a way to make Atmos send mail to anybody.
   *
   * Always reports success. Whether an address is already verified is not
   * something an endpoint should confirm to a caller, and there is nothing
   * useful the person can do differently either way.
   */
  resendVerification: protectedProcedure.mutation(async ({ ctx }) => {
    await enforceRateLimit({
      key: `verify-resend:${ctx.session.user.id}`,
      limit: 5,
      windowSeconds: 60 * 15,
      message: "Too many requests. Try again in a few minutes.",
    });

    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { email: true, emailVerified: true },
    });

    if (!user?.email) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "That account has no email address.",
      });
    }

    if (!user.emailVerified) {
      await auth.api.sendVerificationEmail({
        body: { email: user.email },
        headers: ctx.headers,
      });
    }

    return { ok: true as const, sentTo: user.email };
  }),

  /** The signed-in user's sign-in methods and sessions, for their account page. */
  security: protectedProcedure.query(async ({ ctx }) => {
    const [signIn, sessions] = await Promise.all([
      listSignInMethods(ctx.session.user.id),
      listActiveSessions(ctx.session.user.id),
    ]);
    return {
      ...signIn,
      sessions: sessions.map((session) => ({
        ...session,
        isCurrent: session.id === ctx.session.session.id,
      })),
    };
  }),

  /**
   * Changes the user's own password, checking the current one. Other sessions
   * are signed out here rather than by better-auth, whose version also
   * replaces the current session and would sign this one out too.
   */
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: passwordSchema,
        revokeOtherSessions: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await callAuth(() =>
        auth.api.changePassword({
          body: {
            currentPassword: input.currentPassword,
            newPassword: input.newPassword,
          },
          headers: ctx.headers,
        }),
      );
      if (input.revokeOtherSessions) {
        await ctx.db.session.deleteMany({
          where: {
            userId: ctx.session.user.id,
            id: { not: ctx.session.session.id },
          },
        });
      }
      return { ok: true as const };
    }),

  /** Adds a password to an account that only signs in with Google or Apple. */
  setPassword: protectedProcedure
    .input(z.object({ newPassword: passwordSchema }))
    .mutation(async ({ ctx, input }) => {
      await callAuth(() =>
        auth.api.setPassword({
          body: { newPassword: input.newPassword },
          headers: ctx.headers,
        }),
      );
      return { ok: true as const };
    }),

  /** Removes the password or a linked social account, never the last one. */
  unlinkAccount: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await removeSignInMethod(ctx.session.user.id, input.accountId);
      return { ok: true as const };
    }),

  revokeSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.session.deleteMany({
        where: { id: input.sessionId, userId: ctx.session.user.id },
      });
      return { ok: true as const };
    }),

  revokeOtherSessions: protectedProcedure.mutation(async ({ ctx }) => {
    const { count } = await ctx.db.session.deleteMany({
      where: {
        userId: ctx.session.user.id,
        id: { not: ctx.session.session.id },
      },
    });
    return { ok: true as const, count };
  }),
});
