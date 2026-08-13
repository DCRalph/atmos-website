import "server-only";

import http2 from "node:http2";

import { after } from "next/server";

import { db } from "~/server/db";
import { env } from "~/env";
import { getAppleWalletConfig, isAppleWalletConfigured } from "./apple-config";

/**
 * APNs push for Wallet passes.
 *
 * A pass update notification is an empty payload sent to every device that
 * registered the pass; the phone then calls our web service to fetch the new
 * version. Authentication is TLS client-certificate based using the same Pass
 * Type ID certificate that signs the pass, so there is no separate key to
 * manage.
 *
 * Written against `node:http2` directly rather than an APNs library — it is
 * about sixty lines, and the alternatives are all either unmaintained or built
 * around long-lived connections that a serverless function cannot keep.
 */

const PRODUCTION_HOST = "https://api.push.apple.com:443";
const SANDBOX_HOST = "https://api.sandbox.push.apple.com:443";

export type PushResult = { sent: number; failed: number; pruned: number };

/**
 * Tell every device holding this ticket's pass that it changed.
 * Safe to call when Wallet is not configured — it just does nothing.
 */
export async function pushPassUpdate(
  serialNumber: string,
): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, pruned: 0 };
  if (!isAppleWalletConfigured()) return result;

  const registrations = await db.walletPassRegistration.findMany({
    where: { serialNumber },
    select: { id: true, pushToken: true },
  });
  if (registrations.length === 0) return result;

  const config = getAppleWalletConfig();
  const host = env.NODE_ENV === "production" ? PRODUCTION_HOST : SANDBOX_HOST;

  const client = http2.connect(host, {
    key: config.signerKey,
    cert: config.signerCert,
    passphrase: config.signerKeyPassphrase || undefined,
  });

  const staleIds: string[] = [];

  try {
    await Promise.all(
      registrations.map(
        (registration) =>
          new Promise<void>((resolve) => {
            const request = client.request({
              ":method": "POST",
              ":path": `/3/device/${registration.pushToken}`,
              "apns-topic": config.passTypeIdentifier,
              "apns-push-type": "background",
              "content-type": "application/json",
            });

            request.setEncoding("utf8");
            let status = 0;
            request.on("response", (headers) => {
              status = Number(headers[":status"] ?? 0);
            });
            request.on("end", () => {
              if (status === 200) {
                result.sent += 1;
              } else {
                result.failed += 1;
                // 410 means the device dropped the pass; stop pushing to it.
                if (status === 410) staleIds.push(registration.id);
              }
              resolve();
            });
            request.on("error", () => {
              result.failed += 1;
              resolve();
            });

            // Wallet ignores the payload entirely — an empty object is the
            // documented way to say "come and fetch the new pass".
            request.end("{}");
          }),
      ),
    );
  } finally {
    client.close();
  }

  if (staleIds.length > 0) {
    const pruned = await db.walletPassRegistration.deleteMany({
      where: { id: { in: staleIds } },
    });
    result.pruned = pruned.count;
  }

  return result;
}

/**
 * Push an update for every device that actually registered a pass for this
 * event. The `applePassSerial` marker is best-effort and can be missing even
 * when Wallet already holds the pass.
 */
export async function pushEventPassUpdates(
  eventId: string,
): Promise<PushResult> {
  const totals: PushResult = { sent: 0, failed: 0, pruned: 0 };
  if (!isAppleWalletConfigured()) return totals;

  const tickets = await db.ticket.findMany({
    where: { eventId },
    select: { id: true },
  });
  if (tickets.length === 0) return totals;

  const registrations = await db.walletPassRegistration.findMany({
    where: { serialNumber: { in: tickets.map((ticket) => ticket.id) } },
    distinct: ["serialNumber"],
    select: { serialNumber: true },
  });

  for (const { serialNumber } of registrations) {
    const result = await pushPassUpdate(serialNumber);
    totals.sent += result.sent;
    totals.failed += result.failed;
    totals.pruned += result.pruned;
  }

  return totals;
}

function logPushResult(
  kind: "ticket" | "event",
  id: string,
  result: PushResult,
): void {
  const payload = { kind, id, ...result };
  if (result.failed > 0) {
    console.error("[wallet] pass update push had failures", payload);
    return;
  }
  console.info("[wallet] pass update push", payload);
}

function runAfterResponse(task: () => Promise<void>): void {
  try {
    after(task);
  } catch {
    void task();
  }
}

/** Wake Wallet after a ticket-level change (void, refund) without blocking. */
export function schedulePassUpdate(serialNumber: string): void {
  runAfterResponse(async () => {
    try {
      const result = await pushPassUpdate(serialNumber);
      logPushResult("ticket", serialNumber, result);
    } catch (cause) {
      console.error(
        "[wallet] pass update push failed",
        { serialNumber },
        cause,
      );
    }
  });
}

/** Wake Wallet after a ticketed-event change without blocking the admin save. */
export function scheduleEventPassUpdates(eventId: string): void {
  runAfterResponse(async () => {
    try {
      const result = await pushEventPassUpdates(eventId);
      logPushResult("event", eventId, result);
    } catch (cause) {
      console.error("[wallet] pass update push failed", { eventId }, cause);
    }
  });
}
