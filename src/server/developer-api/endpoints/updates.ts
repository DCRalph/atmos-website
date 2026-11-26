import "server-only";

import { z } from "zod";

import { ALL_SCOPES, permissionsToScopes } from "~/lib/developer/scopes";
import {
  API_UPDATE_TYPE_NAMES,
  UPDATE_RETENTION_DAYS,
} from "~/lib/developer/updates";
import { defineEndpoint } from "../endpoint";
import { commaList, dateTime } from "../schemas";
import {
  listUpdates,
  MAX_UPDATES_PER_PAGE,
  visibleUpdateTypes,
} from "../updates";

/** The update feed, and the key asking about itself. */

const updateType = z.enum(API_UPDATE_TYPE_NAMES);

const feed = defineEndpoint({
  method: "GET",
  path: "/updates",
  tag: "Updates",
  summary: "Read the update feed",
  description: `Everything that happened after \`cursor\`, oldest first. Keep the \`nextCursor\` and ask again with it; it comes back unchanged when there is nothing new, so polling every few seconds is fine. Leave \`cursor\` out to start from the oldest kept update, or send \`now\` to hear only what happens next. Updates are kept for ${UPDATE_RETENTION_DAYS} days, and each type needs the read scope of what it describes on top of updates:read; types the key cannot see are left out.`,
  scope: "updates:read",
  query: z.object({
    cursor: z
      .union([z.string().regex(/^\d+$/), z.literal("now")])
      .optional()
      .describe(
        "The last `nextCursor`. `now` skips everything so far and returns the cursor to start from.",
      ),
    types: commaList(updateType)
      .optional()
      .describe(
        "Comma separated, such as order.paid,tier.sold_out. All by default.",
      ),
    eventId: z.string().optional().describe("Only updates about this event."),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_UPDATES_PER_PAGE)
      .default(MAX_UPDATES_PER_PAGE),
  }),
  response: z.object({
    data: z.array(
      z.object({
        id: z.string(),
        type: updateType,
        createdAt: dateTime,
        gigId: z.string().nullable(),
        eventId: z.string().nullable(),
        orderId: z.string().nullable(),
        data: z.record(z.string(), z.unknown()),
      }),
    ),
    nextCursor: z.string(),
  }),
  run: async ({ query }, ctx) => {
    const visible = visibleUpdateTypes(ctx.has);
    const types = query.types
      ? visible.filter((type) => query.types?.includes(type))
      : visible;
    return listUpdates({
      after:
        query.cursor === "now"
          ? "now"
          : query.cursor
            ? Number(query.cursor)
            : 0,
      types,
      eventId: query.eventId,
      limit: query.limit,
    });
  },
});

const me = defineEndpoint({
  method: "GET",
  path: "/me",
  tag: "Basics",
  summary: "This key",
  description:
    "The key's name, scopes and what is left of its rate limit. Needs no scope, so it is the way to check a key works.",
  scope: null,
  response: z.object({
    name: z.string(),
    scopes: z.array(z.enum(ALL_SCOPES.map((entry) => entry.scope))),
    updateTypes: z
      .array(updateType)
      .describe("The update types this key can read from the feed."),
    rateLimit: z.object({
      remaining: z.number().int().nullable().describe("This minute."),
    }),
    expiresAt: dateTime.nullable(),
  }),
  run: async (_input, ctx) => ({
    name: ctx.key.name,
    scopes: permissionsToScopes(ctx.key.permissions),
    updateTypes: ctx.has("updates:read") ? visibleUpdateTypes(ctx.has) : [],
    rateLimit: { remaining: ctx.key.remaining },
    expiresAt: ctx.key.expiresAt,
  }),
});

export const updateEndpoints = [me, feed];
