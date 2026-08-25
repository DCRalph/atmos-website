import { z } from "zod";

import { TRPCError } from "@trpc/server";

import type { db as Database } from "~/server/db";

import {
  createTRPCRouter,
  adminProcedure,
  doorProcedure,
} from "~/server/api/trpc";
import { rowName, sortSchedule } from "~/lib/run-sheet/schedule";

/**
 * Reading a run sheet.
 *
 * Writing one is `gigs.saveAll`, because a run sheet is part of the gig and is
 * committed with everything else behind one Save. This is the other half: what
 * the app shows a staff member on the night, and what the editor needs to know
 * about cues that have already gone out.
 *
 * Who can read one:
 *
 *   * Admins and organisers, for every gig.
 *   * Door staff, for a gig they are rostered on. Somebody scanning wristbands
 *     needs to know when doors are and when the headliner is on as much as
 *     anybody, and a run sheet they cannot see is a run sheet they will ask
 *     about over the radio instead.
 *
 * Internal notes are the exception and stay with the organisers. Everything
 * else on a run sheet is the shape of the night; a note is somebody writing
 * something down for a specific person to read.
 *
 * Nothing here is public. `doorProcedure` refuses nobody by itself — it only
 * resolves who is asking — so every procedure below checks for itself.
 */

/** Gigs this account may read, or `null` for "all of them". */
async function visibleGigIds(ctx: {
  hasGlobalDoorAccess: boolean;
  session: { user: { id: string } };
  db: typeof Database;
}): Promise<string[] | null> {
  if (ctx.hasGlobalDoorAccess) return null;

  const rostered = await ctx.db.ticketEventStaff.findMany({
    where: { userId: ctx.session.user.id, event: { gigId: { not: null } } },
    select: { event: { select: { gigId: true } } },
  });

  return [
    ...new Set(
      rostered.flatMap((row) => (row.event.gigId ? [row.event.gigId] : [])),
    ),
  ];
}

/** How long after a gig ends its run sheet stays listed. */
const TONIGHT_TAIL_HOURS = 24;

const RUN_SHEET_INCLUDE = {
  scheduleItems: {
    include: {
      artists: {
        orderBy: { sortOrder: "asc" },
        select: {
          creatorProfile: {
            select: { id: true, handle: true, displayName: true },
          },
        },
      },
      recipients: { select: { userId: true } },
      fires: {
        select: {
          offsetMinutes: true,
          skipped: true,
          delivered: true,
          createdAt: true,
        },
      },
    },
  },
  notifyRecipients: {
    select: {
      userId: true,
      user: { select: { id: true, name: true, email: true } },
    },
  },
} as const;

export const runSheetRouter = createTRPCRouter({
  /**
   * One gig's run sheet, in running order, with each row named the way a
   * notification names it.
   *
   * `previousSetName` is on the row rather than worked out on the client: a
   * changeover is defined by the row in front of it, and the app and the cue
   * copy must not disagree about which row that is.
   */
  forGig: doorProcedure
    .input(z.object({ gigId: z.string() }))
    .query(async ({ ctx, input }) => {
      const visible = await visibleGigIds(ctx);
      if (visible !== null && !visible.includes(input.gigId)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not on this gig",
        });
      }
      const gig = await ctx.db.gig.findUnique({
        where: { id: input.gigId },
        select: {
          id: true,
          title: true,
          subtitle: true,
          gigStartTime: true,
          gigEndTime: true,
          ...RUN_SHEET_INCLUDE,
        },
      });
      if (!gig) return null;

      const ordered = sortSchedule(gig.scheduleItems);
      let previousSetName: string | null = null;

      const items = ordered.map((item) => {
        const name = rowName({
          id: item.id,
          kind: item.kind,
          label: item.label,
          role: item.role,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
          sortOrder: item.sortOrder,
          leadMinutes: item.leadMinutes,
          artists: item.artists.map((artist) => artist.creatorProfile),
        });
        const row = {
          id: item.id,
          kind: item.kind,
          name,
          role: item.role,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
          // Organisers only. A note is something somebody wrote down for a
          // particular person, not part of the shape of the night.
          notes: ctx.hasGlobalDoorAccess ? item.notes : null,
          leadMinutes: item.leadMinutes,
          // Everybody in the slot, so a back to back reads as one line and the
          // app can still link each name.
          artists: item.artists.map((artist) => artist.creatorProfile),
          recipientUserIds: item.recipients.map((r) => r.userId),
          fires: item.fires,
          previousSetName: item.kind === "SET" ? previousSetName : null,
        };
        if (item.kind === "SET") previousSetName = name;
        return row;
      });

      return {
        id: gig.id,
        title: gig.title,
        subtitle: gig.subtitle,
        gigStartTime: gig.gigStartTime,
        gigEndTime: gig.gigEndTime,
        items,
        // Who is being told what is an organiser's business.
        recipients: ctx.hasGlobalDoorAccess
          ? gig.notifyRecipients.map((row) => row.user)
          : [],
      };
    }),

  /**
   * Gigs with a run sheet, for the app's way in. The name predates the window:
   * every future gig with rows is listed — a run sheet is worth reading as
   * soon as it exists — and a gig only drops off a day after it ends, once
   * the morning-after check of what actually happened is done with it.
   */
  tonight: doorProcedure.query(async ({ ctx }) => {
    const tailEdge = new Date(
      Date.now() - TONIGHT_TAIL_HOURS * 60 * 60 * 1000,
    );
    const visible = await visibleGigIds(ctx);
    if (visible !== null && visible.length === 0) return [];

    return ctx.db.gig.findMany({
      where: {
        scheduleItems: { some: {} },
        OR: [
          { gigEndTime: { gte: tailEdge } },
          { gigEndTime: null, gigStartTime: { gte: tailEdge } },
        ],
        ...(visible === null ? {} : { id: { in: visible } }),
      },
      orderBy: { gigStartTime: "asc" },
      select: {
        id: true,
        title: true,
        subtitle: true,
        gigStartTime: true,
      },
    });
  }),

  /**
   * Who can be picked to hear a gig's cues.
   *
   * Staff only, and each one carries whether they actually have the app
   * installed. Somebody with no device is not an error — they are on the list
   * and hear nothing, which is worth saying out loud in the picker rather than
   * discovering at 11pm.
   */
  staff: adminProcedure.query(async ({ ctx }) => {
    const users = await ctx.db.user.findMany({
      where: {
        permissions: { some: { permission: { in: ["ADMIN", "EVENT_ORGANISER"] } } },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        permissions: { select: { permission: true } },
        _count: { select: { deviceTokens: true } },
      },
    });

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      permissions: user.permissions.map((row) => row.permission),
      devices: user._count.deviceTokens,
    }));
  }),
});
