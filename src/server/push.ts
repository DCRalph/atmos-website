import "server-only";

import type { Prisma } from "~Prisma/client";

import { gigPath } from "~/lib/gig-url";
import { db } from "~/server/db";

/**
 * Push notifications, through Expo's service.
 *
 * Expo brokers APNs and FCM, so this posts to one endpoint and never handles
 * certificates. Two things it does take seriously:
 *
 * - **Dead tokens are removed, not retried.** A `DeviceNotRegistered` ticket
 *   means the app was deleted or the token rotated; leaving it in the table
 *   means every future send drags a growing tail of failures behind it.
 * - **Nothing here throws.** A notification is a nice-to-have on top of an
 *   action that already succeeded — a gig is published whether or not the
 *   announcement went out, and failing the publish over it would be absurd.
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
/** Expo accepts at most 100 messages per request. */
const BATCH_SIZE = 100;

type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: "default" | null;
  badge?: number;
  /** Expo's own scale, not ntfy's — a low-priority push may be held back. */
  priority?: "normal" | "high";
};

type PushTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

/** The per-device switches somebody can turn off in the app's settings. */
export type PushChannel = "gigAnnouncements" | "doorReminders";

export type Audience =
  | { kind: "everyone"; channel: PushChannel }
  /**
   * Named accounts.
   *
   * `channel` is optional and deliberately so. A cue on a run sheet, a message
   * in a gig room and the Tap to Pay launch notice are operational — somebody
   * working a door does not get to mute the radio — so those pass no channel
   * and reach every handset the account has. A doors-open reminder is a
   * courtesy to a customer, so that one names its channel and honours the
   * switch.
   */
  | { kind: "users"; userIds: string[]; channel?: PushChannel }
  | { kind: "topic"; topic: string };

/**
 * Send one notification to an audience.
 *
 * Returns how many devices it reached, for logging — callers are not expected
 * to do anything with a failure.
 */
export async function sendPush({
  audience,
  title,
  body,
  data,
  sound = "default",
  priority,
}: {
  audience: Audience;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: "default" | null;
  priority?: "normal" | "high";
}): Promise<{ sent: number; removed: number }> {
  const devices = await db.deviceToken.findMany({
    where: audienceFilter(audience),
    select: { token: true },
  });

  if (devices.length === 0) return { sent: 0, removed: 0 };

  const messages: PushMessage[] = devices.map((device) => ({
    to: device.token,
    title,
    body,
    data,
    sound,
    priority,
  }));

  let sent = 0;
  const dead: string[] = [];

  for (let index = 0; index < messages.length; index += BATCH_SIZE) {
    const batch = messages.slice(index, index + BATCH_SIZE);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        console.error("[push] Expo returned", response.status);
        continue;
      }

      const payload = (await response.json()) as { data?: PushTicket[] };
      const tickets = payload.data ?? [];

      tickets.forEach((ticket, position) => {
        if (ticket.status === "ok") {
          sent += 1;
          return;
        }
        if (ticket.details?.error === "DeviceNotRegistered") {
          const token = batch[position]?.to;
          if (token) dead.push(token);
        }
      });
    } catch (cause) {
      console.error("[push] send failed:", cause);
    }
  }

  if (dead.length > 0) {
    await db.deviceToken
      .deleteMany({ where: { token: { in: dead } } })
      .catch(() => undefined);
  }

  return { sent, removed: dead.length };
}

/**
 * How many handsets an audience is, before anything is sent.
 *
 * Recorded alongside the delivery count so "nobody got it" separates into "it
 * went to nobody" and "it went out and did not arrive".
 */
export async function countAudience(audience: Audience): Promise<number> {
  return db.deviceToken.count({ where: audienceFilter(audience) });
}

function audienceFilter(audience: Audience): Prisma.DeviceTokenWhereInput {
  switch (audience.kind) {
    case "users":
      return {
        userId: { in: audience.userIds },
        ...(audience.channel ? { [audience.channel]: true } : {}),
      };
    case "topic":
      return { topics: { has: audience.topic } };
    case "everyone":
      // Preference is per-device, so somebody can mute announcements on a work
      // phone and keep them on their own.
      return { [audience.channel]: true };
  }
}

/** A new gig is up. Goes to everyone who has not muted announcements. */
export async function announceGig({
  gigId,
  title,
  when,
}: {
  gigId: string;
  title: string;
  when: string;
}): Promise<void> {
  await sendPush({
    audience: { kind: "everyone", channel: "gigAnnouncements" },
    title: "New date announced",
    body: `${title} — ${when}`,
    data: { url: gigPath({ id: gigId, title }) },
  });
}

/** Doors tonight, to the people actually holding a ticket for it. */
export async function remindDoorsOpen({
  eventId,
  eventName,
  doorsAt,
}: {
  eventId: string;
  eventName: string;
  doorsAt: string;
}): Promise<void> {
  const orders = await db.ticketOrder.findMany({
    where: { eventId, userId: { not: null }, status: "PAID" },
    select: { userId: true },
  });

  const userIds = [
    ...new Set(
      orders
        .map((order) => order.userId)
        .filter((id): id is string => id !== null),
    ),
  ];
  if (userIds.length === 0) return;

  await sendPush({
    audience: { kind: "users", userIds, channel: "doorReminders" },
    title: `Tonight — ${eventName}`,
    body: `Doors ${doorsAt}. Your ticket is in the app.`,
    data: { url: "/tickets" },
  });
}
