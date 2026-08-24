import type { UserPermission } from "~Prisma/client";

/**
 * Notification topics.
 *
 * A topic is a free string, exactly as in ntfy — publishing to one nobody is
 * subscribed to is a no-op, not an error, so an integration can invent its own
 * without a code change here. The list below is only the set the compose
 * screens offer and the set devices are subscribed to automatically.
 *
 * Kept out of `~/server` on purpose: the admin compose page is a client
 * component and needs the same vocabulary.
 */

/** ntfy's rule: 1-64 characters of letters, digits, dash or underscore. */
const TOPIC_PATTERN = /^[-_A-Za-z0-9]{1,64}$/;

export function isValidTopic(topic: string): boolean {
  return TOPIC_PATTERN.test(topic);
}

export type KnownTopic = {
  name: string;
  label: string;
  description: string;
};

export const KNOWN_TOPICS = [
  {
    name: "team",
    label: "Team",
    description: "Everyone on the Atmos team. The default for a message to us.",
  },
  {
    name: "door",
    label: "Door",
    description: "Door staff — problems at a door that need a hand now.",
  },
  {
    name: "alerts",
    label: "Alerts",
    description:
      "Automated alerts from the site itself. Admins only, so a failed webhook does not wake a scanner.",
  },
  {
    name: "announcements",
    label: "Announcements",
    description:
      "Every install, punters included. Not internal — treat anything sent here as public.",
  },
] as const satisfies readonly KnownTopic[];

/**
 * The topics a device starts out subscribed to, from the permissions of
 * whoever is signed in on it.
 *
 * Applied when a device first registers and again when it changes hands, which
 * is what stops the last person's team alerts following a shared handset. It
 * deliberately does not run on every launch — a topic removed by hand in the
 * admin would otherwise come straight back on the next app open.
 */
export function defaultTopicsFor(
  permissions: readonly UserPermission[],
): string[] {
  // Anyone who installed the app, signed in or not.
  const topics = new Set<string>(["announcements"]);

  if (permissions.includes("ADMIN")) {
    topics.add("team");
    topics.add("door");
    topics.add("alerts");
  }
  if (permissions.includes("EVENT_ORGANISER")) {
    topics.add("team");
    topics.add("door");
  }

  return [...topics];
}

/** ntfy priorities, lowest to highest. 3 is the default. */
export const PRIORITIES = [1, 2, 3, 4, 5] as const;
export type NotifyPriority = (typeof PRIORITIES)[number];

export const DEFAULT_PRIORITY = 3 satisfies NotifyPriority;

export function isPriority(value: number): value is NotifyPriority {
  return PRIORITIES.some((priority) => priority === value);
}

/** ntfy accepts either the number or the name. */
const PRIORITY_NAMES: Record<string, NotifyPriority> = {
  min: 1,
  low: 2,
  default: 3,
  high: 4,
  max: 5,
  urgent: 5,
};

export function parsePriority(raw: string): NotifyPriority | null {
  const value = raw.trim().toLowerCase();
  if (value.length === 0) return null;

  const named = PRIORITY_NAMES[value];
  if (named) return named;

  const numeric = Number(value);
  return Number.isInteger(numeric) && isPriority(numeric) ? numeric : null;
}
