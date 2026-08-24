import "server-only";

import { db } from "~/server/db";
import { countAudience, sendPush, type Audience } from "~/server/push";
import { KNOWN_TOPICS } from "~/lib/notify/topics";
import type { PublishInput } from "~/lib/notify/ntfy-request";

/**
 * Publishing a notification to a topic.
 *
 * The one place a notification is turned into pushes, shared by the ntfy
 * endpoint, the admin compose page and the app's compose screen — so all three
 * enforce the same limits and leave the same audit row.
 *
 * ntfy semantics are kept where they are cheap and dropped where they are not:
 * publishing to a topic nobody is subscribed to succeeds with `devices: 0`
 * rather than erroring, because that is what a message board does. What is not
 * kept is ntfy's message cache — there is no `since=` to replay from, since a
 * push either reaches a handset or does not.
 *
 * `origin.audience` is the one deliberate break from ntfy. A run sheet cue goes
 * to the people an admin picked for that gig, not to whoever happens to be
 * subscribed to a topic, so it overrides the fan-out while still logging under
 * a topic — which keeps every notification the site has ever sent in one list.
 */

/** What the ntfy API hands back, plus what we actually did with it. */
export type PublishedMessage = {
  id: string;
  /** Unix seconds, as ntfy reports it. */
  time: number;
  event: "message";
  topic: string;
  title?: string;
  message: string;
  priority: number;
  tags?: string[];
  click?: string;
  /** Atmos extension: devices subscribed, and pushes Expo accepted. */
  delivery: { devices: number; delivered: number };
};

export type PublishSource = "api" | "admin" | "run-sheet";

export async function publish(
  input: PublishInput,
  origin: {
    source: PublishSource;
    senderId?: string;
    /** Defaults to everyone subscribed to `input.topic`. */
    audience?: Audience;
  },
): Promise<PublishedMessage> {
  const audience: Audience = origin.audience ?? {
    kind: "topic",
    topic: input.topic,
  };
  const devices = await countAudience(audience);

  const { sent } = await sendPush({
    audience,
    // A notification with no title is nearly unreadable on a lock screen, so
    // the topic names itself rather than leaving the app name to do it.
    title: input.title ?? topicLabel(input.topic),
    body: input.message,
    data: notificationData(input),
    // 1 and 2 are ntfy's "do not interrupt me" tiers.
    sound: input.priority <= 2 ? null : "default",
    priority: input.priority >= 4 ? "high" : "normal",
  });

  const row = await db.notifyMessage.create({
    data: {
      topic: input.topic,
      title: input.title ?? null,
      message: input.message,
      priority: input.priority,
      tags: input.tags,
      click: input.click ?? null,
      source: origin.source,
      senderId: origin.senderId ?? null,
      devices,
      delivered: sent,
    },
    select: { id: true, createdAt: true },
  });

  return {
    id: row.id,
    time: Math.floor(row.createdAt.getTime() / 1000),
    event: "message",
    topic: input.topic,
    title: input.title,
    message: input.message,
    priority: input.priority,
    tags: input.tags.length > 0 ? input.tags : undefined,
    click: input.click,
    delivery: { devices, delivered: sent },
  };
}

/**
 * Expo caps the data payload, and it has to be strings — so only what the app
 * acts on travels, and the tags ride along for display rather than as ntfy's
 * emoji shorthand, which is not implemented.
 */
function notificationData(input: PublishInput): Record<string, string> {
  const data: Record<string, string> = { topic: input.topic };
  if (input.click) data.url = input.click;
  if (input.tags.length > 0) data.tags = input.tags.join(",");
  return data;
}

function topicLabel(topic: string): string {
  return KNOWN_TOPICS.find((known) => known.name === topic)?.label ?? topic;
}
