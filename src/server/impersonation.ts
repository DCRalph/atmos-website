import { type BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  getSessionFromCtx,
  sessionMiddleware,
} from "better-auth/api";
import {
  deleteSessionCookie,
  expireCookie,
  setSessionCookie,
} from "better-auth/cookies";
import { z } from "zod";

import { db } from "~/server/db";
import { logUserActivity } from "~/server/utils/activity-log";
import { isAdminTier, userHasPermission } from "~/server/utils/permissions";
import { ActivityType } from "~Prisma/client";

/** How long a "view as" session lasts before it expires on its own. */
const IMPERSONATION_MS = 60 * 60 * 1000;

/**
 * "View as user" for the admin console.
 *
 * The same mechanism as better-auth's admin plugin (a short session for the
 * target, stamped with `impersonatedBy`, and the admin's own session parked
 * in a signed `admin_session` cookie), without the plugin's role and ban
 * columns: who may do it is decided by our permission table instead.
 *
 * Admins may view as anyone outside the admin tier, so admin access can
 * never be borrowed. Every start is in the activity log.
 *
 * Client: `authClient.impersonation.start({ userId })` and
 * `authClient.impersonation.stop()`, each followed by a full page load.
 */
export const impersonation = () =>
  ({
    id: "impersonation",
    schema: {
      session: {
        fields: {
          impersonatedBy: { type: "string", required: false, input: false },
        },
      },
    },
    endpoints: {
      startImpersonating: createAuthEndpoint(
        "/impersonation/start",
        {
          method: "POST",
          body: z.object({ userId: z.string() }),
          use: [sessionMiddleware],
        },
        async (ctx) => {
          const actor = ctx.context.session;
          if (actor.session.impersonatedBy) {
            throw APIError.from("BAD_REQUEST", {
              message: "Stop viewing as this user first",
              code: "ALREADY_IMPERSONATING",
            });
          }

          const [admin, target] = await Promise.all(
            [actor.user.id, ctx.body.userId].map((id) =>
              db.user.findUnique({
                where: { id },
                include: { permissions: true },
              }),
            ),
          );
          if (!admin || !userHasPermission(admin, "ADMIN")) {
            throw APIError.from("FORBIDDEN", {
              message: "Admin permission required",
              code: "NOT_ADMIN",
            });
          }
          if (!target) {
            throw APIError.from("NOT_FOUND", {
              message: "User not found",
              code: "USER_NOT_FOUND",
            });
          }
          if (isAdminTier(target.permissions.map((row) => row.permission))) {
            throw APIError.from("FORBIDDEN", {
              message: "Admins can't be viewed as",
              code: "TARGET_IS_ADMIN",
            });
          }

          const session = await ctx.context.internalAdapter.createSession(
            target.id,
            true,
            {
              impersonatedBy: admin.id,
              expiresAt: new Date(Date.now() + IMPERSONATION_MS),
            },
            true,
          );

          const dontRememberMe = await ctx.getSignedCookie(
            ctx.context.authCookies.dontRememberToken.name,
            ctx.context.secret,
          );
          deleteSessionCookie(ctx);
          await ctx.setSignedCookie(
            ctx.context.createAuthCookie("admin_session").name,
            `${actor.session.token}:${dontRememberMe ?? ""}`,
            ctx.context.secret,
            ctx.context.authCookies.sessionToken.attributes,
          );
          await setSessionCookie(ctx, { session, user: target }, true);

          await logUserActivity(
            ActivityType.USER_IMPERSONATED,
            `Viewed the site as ${target.name || target.email}`,
            admin.id,
            target.id,
          );

          return ctx.json({ ok: true });
        },
      ),

      stopImpersonating: createAuthEndpoint(
        "/impersonation/stop",
        { method: "POST", requireHeaders: true },
        async (ctx) => {
          const current = await getSessionFromCtx<
            Record<string, unknown>,
            { impersonatedBy?: string | null }
          >(ctx);
          const adminId = current?.session.impersonatedBy;
          if (!current || !adminId) {
            throw APIError.from("BAD_REQUEST", {
              message: "You aren't viewing as anyone",
              code: "NOT_IMPERSONATING",
            });
          }

          const adminCookie = ctx.context.createAuthCookie("admin_session");
          const parked = await ctx.getSignedCookie(
            adminCookie.name,
            ctx.context.secret,
          );
          const [adminToken = "", dontRememberMe] = parked
            ? parked.split(":")
            : [];
          const adminSession =
            await ctx.context.internalAdapter.findSession(adminToken);

          // The view-as session goes either way; a missing admin session just
          // means signing back in.
          await ctx.context.internalAdapter.deleteSession(
            current.session.token,
          );
          expireCookie(ctx, adminCookie);
          if (adminSession?.session.userId === adminId) {
            await setSessionCookie(ctx, adminSession, !!dontRememberMe);
          } else {
            deleteSessionCookie(ctx);
          }
          return ctx.json({ ok: true });
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
