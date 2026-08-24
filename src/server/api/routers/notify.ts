import { z } from "zod";
import { TRPCError } from "@trpc/server";

import {
  adminProcedure,
  createTRPCRouter,
  eventOrganiserProcedure,
} from "~/server/api/trpc";
import { publish } from "~/server/notify";
import {
  DEFAULT_PRIORITY,
  isValidTopic,
  KNOWN_TOPICS,
  PRIORITIES,
} from "~/lib/notify/topics";

/**
 * Team notifications, for the compose screens.
 *
 * The HTTP side of this lives at `/api/notify` and speaks ntfy; both end up in
 * `publish()`, so a message sent from the admin and one sent by a shell script
 * are the same message with a different `source`.
 *
 * Sending is open to organisers, because the case that matters is somebody at
 * a door with a problem — but `announcements` reaches every install including
 * punters, so that one topic is admin-only. Managing which device hears what
 * is admin-only throughout.
 */

const topic = z.string().refine(isValidTopic, "invalid topic");

/** ntfy's own limits, mirrored from `~/lib/notify/ntfy-request`. */
const publishInput = z.object({
  topic,
  message: z.string().trim().min(1).max(4096),
  title: z.string().trim().max(250).optional(),
  priority: z
    .union(PRIORITIES.map((value) => z.literal(value)))
    .default(DEFAULT_PRIORITY),
  tags: z.array(z.string().trim().min(1)).max(20).default([]),
  click: z.string().trim().max(2000).optional(),
});

export const notifyRouter = createTRPCRouter({
  /** Every topic worth offering, with how many devices would actually hear it. */
  topics: eventOrganiserProcedure.query(async ({ ctx }) => {
    const devices = await ctx.db.deviceToken.findMany({
      select: { topics: true },
    });

    const counts = new Map<string, number>();
    for (const device of devices) {
      for (const name of device.topics) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }

    // Topics somebody invented through the API show up alongside the known
    // ones, so the compose screen is not lying about what exists.
    const known = KNOWN_TOPICS.map((entry) => ({
      ...entry,
      devices: counts.get(entry.name) ?? 0,
    }));
    const extra = [...counts.keys()]
      .filter((name) => !KNOWN_TOPICS.some((entry) => entry.name === name))
      .map((name) => ({
        name,
        label: name,
        description: "Created through the API.",
        devices: counts.get(name) ?? 0,
      }));

    return [...known, ...extra];
  }),

  /** What has gone out lately, newest first. */
  recent: eventOrganiserProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.notifyMessage.findMany({
        orderBy: { createdAt: "desc" },
        take: input.limit,
        include: { sender: { select: { id: true, name: true } } },
      });
    }),

  send: eventOrganiserProcedure
    .input(publishInput)
    .mutation(async ({ ctx, input }) => {
      // Everything else here reaches staff. This one reaches punters.
      if (input.topic === "announcements" && !ctx.isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Announcements reach every install — admin only.",
        });
      }

      return publish(input, { source: "admin", senderId: ctx.user.id });
    }),

  /**
   * Exactly whose phone lights up, before anything is sent.
   *
   * Only staff handsets are named. Everything else subscribed is a number,
   * which is both the honest way to show `announcements` — four hundred
   * punters is a count, not a list — and what stops an organiser reading a
   * roster of customers off the compose screen.
   */
  audience: eventOrganiserProcedure
    .input(z.object({ topic }))
    .query(async ({ ctx, input }) => {
      const staff = await ctx.db.user.findMany({
        where: {
          permissions: {
            some: { permission: { in: ["ADMIN", "EVENT_ORGANISER"] } },
          },
        },
        select: { id: true },
      });

      const [subscribed, staffDevices] = await Promise.all([
        ctx.db.deviceToken.count({ where: { topics: { has: input.topic } } }),
        ctx.db.deviceToken.findMany({
          where: { userId: { in: staff.map((member) => member.id) } },
          orderBy: { lastSeenAt: "desc" },
          select: {
            id: true,
            platform: true,
            label: true,
            topics: true,
            lastSeenAt: true,
            user: { select: { id: true, name: true, email: true } },
          },
        }),
      ]);

      const listening = staffDevices.filter((device) =>
        device.topics.includes(input.topic),
      );

      return {
        topic: input.topic,
        subscribed,
        listening,
        /** Staff handsets that would miss this, so they can be added here. */
        missing: staffDevices.filter(
          (device) => !device.topics.includes(input.topic),
        ),
        /** Subscribed devices that are not staff. Counted, never listed. */
        others: Math.max(0, subscribed - listening.length),
      };
    }),

  /**
   * Subscribe or unsubscribe one handset, from the audience panel.
   *
   * Admin-only, and per device rather than per person on purpose: muting a
   * topic on a work phone should leave it alone on your own.
   */
  setDeviceTopic: adminProcedure
    .input(z.object({ deviceId: z.string(), topic, subscribed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const device = await ctx.db.deviceToken.findUnique({
        where: { id: input.deviceId },
        select: { topics: true },
      });
      if (!device) throw new TRPCError({ code: "NOT_FOUND" });

      const topics = new Set(device.topics);
      if (input.subscribed) topics.add(input.topic);
      else topics.delete(input.topic);

      await ctx.db.deviceToken.update({
        where: { id: input.deviceId },
        data: { topics: [...topics] },
      });
      return { ok: true as const };
    }),
});
