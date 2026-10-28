import { z } from "zod";

import type { ApiScope } from "~/lib/developer/scopes";
import { DEFAULT_PRIORITY, isValidTopic, parsePriority } from "./topics";

/**
 * The body of `POST /api/v1/notifications/send`, and the message fields it
 * shares with the compose screens' tRPC input.
 *
 * Pure, so it is tested without a route. See `docs/DEVELOPER-API.md`.
 */

/** User or device ids in one direct send. */
export const MAX_RECIPIENTS = 50;

export const topicName = z.string().refine(isValidTopic, "invalid topic");

/** Number 1–5, or ntfy's names for them (`"high"`, `"urgent"`, …). */
const priority = z
  .union([z.number(), z.string()])
  .transform((value, ctx) => {
    const parsed = parsePriority(String(value));
    if (parsed === null) {
      ctx.addIssue({
        code: "custom",
        message: "priority must be 1-5 or min, low, default, high, max",
      });
      return z.NEVER;
    }
    return parsed;
  })
  .default(DEFAULT_PRIORITY);

/**
 * Everything about a notification except who it goes to. The limits are
 * ntfy's, mirrored from `./ntfy-request`.
 */
export const messageFields = {
  message: z.string().trim().min(1).max(4096),
  title: z.string().trim().max(250).optional(),
  priority,
  tags: z.array(z.string().trim().min(1)).max(20).default([]),
  /** Tap target: an absolute URL opens in the browser, a path in the app. */
  click: z.string().trim().max(2000).optional(),
};

const ids = z
  .array(z.string().trim().min(1).max(100))
  .min(1)
  .max(MAX_RECIPIENTS)
  .transform((list) => [...new Set(list)]);

/**
 * Exactly one target. Each shape is strict, so `{ topic, users }` fails
 * rather than quietly sending to one of them.
 */
const target = z.union(
  [
    z.strictObject({ topic: topicName }),
    z.strictObject({ users: ids }),
    z.strictObject({ devices: ids }),
  ],
  {
    error:
      'to must be one of {"topic": name}, {"users": [ids]} or {"devices": [ids]}',
  },
);

/** Strict too, so `"body"` instead of `"message"` is a 400, not a blank push. */
export const sendRequest = z.strictObject({ to: target, ...messageFields });

export type SendRequest = z.infer<typeof sendRequest>;
export type SendTarget = SendRequest["to"];

/** The scope a key needs to send to this target. */
export function scopeForTarget(to: SendTarget): ApiScope {
  if ("topic" in to) {
    return to.topic === "announcements"
      ? "notifications:announce"
      : "notifications:topic";
  }
  return "notifications:direct";
}
