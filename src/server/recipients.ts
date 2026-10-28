import "server-only";

import type { Prisma } from "~Prisma/client";

import { KNOWN_TOPICS } from "~/lib/notify/topics";
import type { SendTarget } from "~/lib/notify/send-request";
import { db } from "~/server/db";
import type { Audience } from "~/server/push";

/**
 * Who the developer API can reach.
 *
 * Staff are named, with their handsets. Everyone else is a count. That is the
 * rule the compose screen's audience panel already follows, and an API key is
 * a worse place to leak a customer roster than a screen. Direct sends are held
 * to the same line: an id that discovery would not have listed is refused.
 */

/** The same set the compose screen names. SUPERADMIN always holds ADMIN too. */
const isStaff = {
  permissions: { some: { permission: { in: ["ADMIN", "EVENT_ORGANISER"] } } },
} satisfies Prisma.UserWhereInput;

/** A topic and how many devices hear it. Label and description are null for
 * topics an integration invented. */
type RecipientTopic = {
  name: string;
  label: string | null;
  description: string | null;
  devices: number;
};

/** Backs `GET /api/v1/notifications/recipients` and the admin reference tab. */
export async function listRecipients() {
  const [devices, staff] = await Promise.all([
    db.deviceToken.findMany({ select: { topics: true } }),
    db.user.findMany({
      where: isStaff,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        permissions: { select: { permission: true } },
        deviceTokens: {
          orderBy: { lastSeenAt: "desc" },
          select: {
            id: true,
            label: true,
            platform: true,
            topics: true,
            lastSeenAt: true,
          },
        },
      },
    }),
  ]);

  const counts = new Map<string, number>();
  for (const device of devices) {
    for (const topic of device.topics) {
      counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
  }

  // Known topics first, in their own order, then anything an integration
  // invented that somebody is subscribed to.
  const topics: RecipientTopic[] = [
    ...KNOWN_TOPICS.map((known) => ({
      name: known.name,
      label: known.label,
      description: known.description,
      devices: counts.get(known.name) ?? 0,
    })),
    ...[...counts.entries()]
      .filter(([name]) => !KNOWN_TOPICS.some((known) => known.name === name))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({
        name,
        label: null,
        description: null,
        devices: count,
      })),
  ];

  const users = staff.map(({ permissions, deviceTokens, ...user }) => ({
    ...user,
    roles: permissions.map((row) => row.permission).sort(),
    devices: deviceTokens,
  }));

  const staffDevices = users.reduce(
    (sum, user) => sum + user.devices.length,
    0,
  );

  return {
    topics,
    users,
    others: { devices: Math.max(0, devices.length - staffDevices) },
  };
}

export type Recipients = Awaited<ReturnType<typeof listRecipients>>;

type DirectTarget = Exclude<SendTarget, { topic: string }>;

/**
 * Turn a direct send's ids into an audience, or report the ones that are not
 * staff (or a staff member's device). All or nothing: a typo in one id should
 * fail the send, not quietly leave somebody out of it.
 */
export async function resolveDirectTarget(
  to: DirectTarget,
): Promise<
  { ok: true; audience: Audience } | { ok: false; unknown: string[] }
> {
  if ("users" in to) {
    const found = await db.user.findMany({
      where: { id: { in: to.users }, ...isStaff },
      select: { id: true },
    });
    const unknown = missing(to.users, found);
    return unknown.length > 0
      ? { ok: false, unknown }
      : { ok: true, audience: { kind: "users", userIds: to.users } };
  }

  const found = await db.deviceToken.findMany({
    where: { id: { in: to.devices }, user: isStaff },
    select: { id: true },
  });
  const unknown = missing(to.devices, found);
  return unknown.length > 0
    ? { ok: false, unknown }
    : { ok: true, audience: { kind: "devices", deviceIds: to.devices } };
}

function missing(ids: string[], found: { id: string }[]): string[] {
  const known = new Set(found.map((row) => row.id));
  return ids.filter((id) => !known.has(id));
}
