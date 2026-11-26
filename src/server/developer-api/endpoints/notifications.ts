import "server-only";

import { z } from "zod";

import { UserPermission } from "~Prisma/client";
import { scopeForTarget, sendRequest } from "~/lib/notify/send-request";
import { DIRECT_TOPIC } from "~/lib/notify/topics";
import { publish } from "~/server/notify";
import type { Audience } from "~/server/push";
import { listRecipients, resolveDirectTarget } from "~/server/recipients";
import { ApiError, defineEndpoint } from "../endpoint";
import { dateTime } from "../schemas";

/**
 * Push notifications: who can be reached, and sending to them. Unchanged on
 * the wire from the first version of the API. See `docs/DEVELOPER-API.md`.
 */

const recipients = defineEndpoint({
  method: "GET",
  path: "/notifications/recipients",
  tag: "Notifications",
  summary: "Discover recipients",
  description:
    "Every topic with how many devices hear it, staff with their devices, and everyone else as a count. Customers are never listed.",
  scope: "notifications:recipients",
  response: z.object({
    topics: z.array(
      z.object({
        name: z.string(),
        label: z.string().nullable(),
        description: z.string().nullable(),
        devices: z.number().int(),
      }),
    ),
    users: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        roles: z.array(z.enum(UserPermission)),
        devices: z.array(
          z.object({
            id: z.string(),
            label: z.string().nullable(),
            platform: z.string(),
            topics: z.array(z.string()),
            lastSeenAt: dateTime,
          }),
        ),
      }),
    ),
    others: z.object({ devices: z.number().int() }),
  }),
  run: () => listRecipients(),
});

const send = defineEndpoint({
  method: "POST",
  path: "/notifications/send",
  tag: "Notifications",
  summary: "Send a notification",
  description:
    "One notification to exactly one target: a topic, staff by user id, or particular devices. Direct sends reach the person whatever their notification settings, like a run sheet cue.",
  scope: {
    mayNeed: [
      "notifications:topic",
      "notifications:announce",
      "notifications:direct",
    ],
    pick: (body) => [scopeForTarget(body.to)],
  },
  body: sendRequest,
  example: {
    to: { topic: "team" },
    title: "Side door",
    message: "Card reader is down",
    priority: 4,
    tags: ["warning"],
  },
  response: z.object({
    id: z.string(),
    createdAt: dateTime,
    to: z.unknown().describe("The target, as sent."),
    delivery: z.object({
      devices: z.number().int(),
      delivered: z.number().int().describe("Accepted by Expo."),
    }),
  }),
  run: async ({ body }, ctx) => {
    const { to, ...message } = body;

    let topic = DIRECT_TOPIC;
    let audience: Audience | undefined;
    if ("topic" in to) {
      topic = to.topic;
    } else {
      const resolved = await resolveDirectTarget(to);
      if (!resolved.ok) {
        throw new ApiError(
          400,
          "unknown_recipients",
          "These ids are not staff or staff devices. GET /api/v1/notifications/recipients lists the ones you can use.",
          { ids: resolved.unknown },
        );
      }
      audience = resolved.audience;
    }

    const sent = await publish(
      { topic, ...message },
      {
        source: "api",
        apiKeyId: ctx.key.keyId ?? undefined,
        audience,
        recipients: "topic" in to ? undefined : to,
      },
    );

    return {
      id: sent.id,
      createdAt: new Date(sent.time * 1000),
      to,
      delivery: sent.delivery,
    };
  },
});

export const notificationEndpoints = [recipients, send];
