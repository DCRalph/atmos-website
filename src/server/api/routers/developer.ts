import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { ActivityType } from "~Prisma/client";
import { createTRPCRouter, superadminProcedure } from "~/server/api/trpc";
import { auth } from "~/server/auth";
import { openApiSpec } from "~/server/developer-api/openapi";
import { logActivity } from "~/server/utils/activity-log";
import {
  isApiScope,
  KEY_EXPIRY_DAYS,
  KEY_NAME_MAX_LENGTH,
  permissionsToScopes,
  scopesToPermissions,
  type ApiScope,
} from "~/lib/developer/scopes";

/**
 * The admin's Developer page: API keys and the API reference. Superadmin only,
 * throughout.
 *
 * Keys are created through better-auth's api-key plugin, which hashes them,
 * and are otherwise read and changed with Prisma directly. Its own list and
 * update are scoped to the caller's keys, and here every superadmin manages
 * every key. Its HTTP routes are switched off in `~/server/auth`, so this
 * router is the only way in. See `docs/DEVELOPER-API.md`.
 */

const storedPermissions = z.record(z.string(), z.array(z.string()));

/** The plugin stores scopes as a JSON string. Anything unreadable is none. */
function readScopes(raw: string | null): ApiScope[] {
  if (!raw) return [];
  try {
    const parsed = storedPermissions.safeParse(JSON.parse(raw));
    return parsed.success ? permissionsToScopes(parsed.data) : [];
  } catch {
    return [];
  }
}

const keyId = z.object({ id: z.string().min(1) });

const scopeList = z
  .array(
    z.custom<ApiScope>(
      (value) => typeof value === "string" && isApiScope(value),
      "unknown scope",
    ),
  )
  .min(1);

/** Playground keys are named this, so expired ones can be cleared away. */
const PLAYGROUND_KEY_NAME = "Playground (temporary)";
const PLAYGROUND_KEY_SECONDS = 60 * 60;

export const developerRouter = createTRPCRouter({
  /**
   * Every key, newest first, with who made it and how much it has sent.
   * Playground keys are left out: they last an hour and belong to one tab.
   */
  keys: superadminProcedure.query(async ({ ctx }) => {
    const keys = await ctx.db.apiKey.findMany({
      where: { name: { not: PLAYGROUND_KEY_NAME } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        start: true,
        permissions: true,
        enabled: true,
        expiresAt: true,
        lastRequest: true,
        createdAt: true,
        referenceId: true,
        _count: { select: { notifyMessages: true } },
      },
    });

    // No foreign key to the creator, on purpose, so look them up.
    const creators = await ctx.db.user.findMany({
      where: { id: { in: [...new Set(keys.map((key) => key.referenceId))] } },
      select: { id: true, name: true },
    });
    const creatorById = new Map(creators.map((user) => [user.id, user]));

    const now = new Date();
    return keys.map(({ permissions, referenceId, _count, ...key }) => ({
      ...key,
      // The plugin deletes an expired key the next time it is used, so one
      // only shows as expired until then.
      expired: key.expiresAt !== null && key.expiresAt < now,
      scopes: readScopes(permissions),
      createdBy: creatorById.get(referenceId) ?? null,
      sends: _count.notifyMessages,
    }));
  }),

  /** Returns the key itself. This is the only time it is ever readable. */
  createKey: superadminProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(KEY_NAME_MAX_LENGTH),
        scopes: scopeList,
        expiresInDays: z
          .union(KEY_EXPIRY_DAYS.map((days) => z.literal(days)))
          .nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const scopes = [...new Set(input.scopes)];
      const created = await auth.api.createApiKey({
        body: {
          name: input.name,
          userId: ctx.user.id,
          permissions: scopesToPermissions(scopes),
          expiresIn: input.expiresInDays
            ? input.expiresInDays * 24 * 60 * 60
            : null,
        },
      });

      await logActivity({
        type: ActivityType.API_KEY_CREATED,
        action: `Created API key "${input.name}"`,
        userId: ctx.user.id,
        details: {
          keyId: created.id,
          scopes,
          expiresInDays: input.expiresInDays,
        },
      });

      return { id: created.id, name: input.name, key: created.key };
    }),

  /** Pause or resume a key. A disabled key gets 401 until it is turned back on. */
  setKeyEnabled: superadminProcedure
    .input(keyId.extend({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const key = await ctx.db.apiKey
        .update({
          where: { id: input.id },
          data: { enabled: input.enabled },
          select: { id: true, name: true },
        })
        .catch(() => {
          throw new TRPCError({ code: "NOT_FOUND", message: "No such key" });
        });

      await logActivity({
        type: ActivityType.API_KEY_UPDATED,
        action: `${input.enabled ? "Enabled" : "Disabled"} API key "${key.name}"`,
        userId: ctx.user.id,
        details: { keyId: key.id, enabled: input.enabled },
      });

      return key;
    }),

  /** Revoke for good. Its sends stay in the history, unlinked from it. */
  deleteKey: superadminProcedure
    .input(keyId)
    .mutation(async ({ ctx, input }) => {
      const key = await ctx.db.apiKey
        .delete({ where: { id: input.id }, select: { id: true, name: true } })
        .catch(() => {
          throw new TRPCError({ code: "NOT_FOUND", message: "No such key" });
        });

      await logActivity({
        type: ActivityType.API_KEY_DELETED,
        action: `Deleted API key "${key.name}"`,
        userId: ctx.user.id,
        details: { keyId: key.id },
      });

      return key;
    }),

  /** The API's OpenAPI spec, which the reference and playground render. */
  spec: superadminProcedure.query(() => openApiSpec()),

  /**
   * A key for the playground: the scopes asked for, gone in an hour. It is a
   * real key, so the playground sees exactly what an integration would. Only
   * the page that made it holds it, in memory. Expired playground keys are
   * deleted whenever a new one is made.
   */
  createPlaygroundKey: superadminProcedure
    .input(z.object({ scopes: scopeList }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.apiKey.deleteMany({
        where: { name: PLAYGROUND_KEY_NAME, expiresAt: { lt: new Date() } },
      });

      const scopes = [...new Set(input.scopes)];
      const created = await auth.api.createApiKey({
        body: {
          name: PLAYGROUND_KEY_NAME,
          userId: ctx.user.id,
          permissions: scopesToPermissions(scopes),
          expiresIn: PLAYGROUND_KEY_SECONDS,
        },
      });

      await logActivity({
        type: ActivityType.API_KEY_CREATED,
        action: "Created a playground API key",
        userId: ctx.user.id,
        details: { keyId: created.id, scopes, playground: true },
      });

      return {
        key: created.key,
        scopes,
        expiresAt: new Date(Date.now() + PLAYGROUND_KEY_SECONDS * 1000),
      };
    }),

  /** Recent gigs and events by name, for the playground's id fields. */
  playgroundIds: superadminProcedure.query(async ({ ctx }) => {
    const [gigs, events] = await Promise.all([
      ctx.db.gig.findMany({
        orderBy: { gigStartTime: "desc" },
        take: 40,
        select: { id: true, title: true, gigStartTime: true },
      }),
      ctx.db.ticketEvent.findMany({
        orderBy: { startsAt: "desc" },
        take: 40,
        select: { id: true, name: true, startsAt: true },
      }),
    ]);
    return {
      gigs: gigs.map((gig) => ({
        id: gig.id,
        label: gig.title,
        at: gig.gigStartTime,
      })),
      events: events.map((event) => ({
        id: event.id,
        label: event.name,
        at: event.startsAt,
      })),
    };
  }),
});
