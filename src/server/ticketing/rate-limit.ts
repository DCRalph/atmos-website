import "server-only";

import { TRPCError } from "@trpc/server";

import { db } from "~/server/db";

/**
 * A small fixed-window rate limiter backed by `KeyValueStore`.
 *
 * In-memory counters are useless here: every Vercel invocation is a fresh
 * process, so an attacker gets a clean allowance per lambda. This does one
 * upserting write per guarded call, which is fine for the endpoints that
 * matter — creating a checkout, trying a discount code, scanning a QR — and
 * those are all low-volume compared to page views.
 *
 * The window resets on a boundary rather than sliding. Slightly blunter than a
 * sliding window, and a lot cheaper.
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
};

export async function rateLimit({
  key,
  limit,
  windowSeconds,
}: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const windowMs = windowSeconds * 1000;
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const storageKey = `rl:${key}:${windowStart}`;
  const resetAt = new Date(windowStart + windowMs);

  // One statement, so two concurrent requests can't both read "0".
  const rows = await db.$queryRaw<{ value: string }[]>`
    INSERT INTO "key_value_store" ("key", "value", "createdAt", "updatedAt")
    VALUES (${storageKey}, '1', NOW(), NOW())
    ON CONFLICT ("key") DO UPDATE
      SET "value" = (("key_value_store"."value")::int + 1)::text,
          "updatedAt" = NOW()
    RETURNING "value"
  `;

  const count = Number.parseInt(rows[0]?.value ?? "1", 10);

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt,
  };
}

/** Throw a tRPC error when over the limit. */
export async function enforceRateLimit(options: {
  key: string;
  limit: number;
  windowSeconds: number;
  message?: string;
}): Promise<void> {
  const result = await rateLimit(options);
  if (!result.allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message:
        options.message ?? "That's a few too many tries — wait a moment.",
    });
  }
}

/**
 * Delete expired limiter rows. Called by the ticketing cron so the table does
 * not accumulate one row per window forever.
 */
export async function pruneRateLimitKeys(olderThanHours = 6): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  const result = await db.keyValueStore.deleteMany({
    where: { key: { startsWith: "rl:" }, updatedAt: { lt: cutoff } },
  });
  return result.count;
}
