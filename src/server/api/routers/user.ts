import { TRPCError } from "@trpc/server";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { userHasPermission } from "~/server/utils/permissions";
import { auth } from "~/server/auth";
import { enforceRateLimit } from "~/server/ticketing/rate-limit";
import type { UserPermission } from "~Prisma/client";

const ALL_PERMISSIONS: UserPermission[] = [
  "EVENT_ORGANISER",
  "CREATOR",
  "ADMIN",
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
});
