import { z } from "zod";

import {
  createTRPCRouter,
  adminProcedure,
  eventOrganiserProcedure,
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
 * Everything here is behind `eventOrganiserProcedure` or stricter. A run sheet
 * carries set times, internal notes and who is being told what, none of which
 * belongs on a public gig page.
 */

/** How far either side of now a gig counts as "on". */
const TONIGHT_HOURS = 12;

const RUN_SHEET_INCLUDE = {
  scheduleItems: {
    include: {
      creatorProfile: { select: { id: true, handle: true, displayName: true } },
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
  forGig: eventOrganiserProcedure
    .input(z.object({ gigId: z.string() }))
    .query(async ({ ctx, input }) => {
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
          creatorProfile: item.creatorProfile,
        });
        const row = {
          id: item.id,
          kind: item.kind,
          name,
          role: item.role,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
          notes: item.notes,
          leadMinutes: item.leadMinutes,
          handle: item.creatorProfile?.handle ?? null,
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
        recipients: gig.notifyRecipients.map((row) => row.user),
      };
    }),

  /**
   * Gigs with a run sheet running around now, for the app's way in.
   *
   * Keyed off the rows rather than off `gigStartTime`, because a load-in is
   * hours before the gig starts and that is exactly when somebody opens this.
   */
  tonight: eventOrganiserProcedure.query(async ({ ctx }) => {
    const span = TONIGHT_HOURS * 60 * 60 * 1000;
    const now = Date.now();

    const items = await ctx.db.gigScheduleItem.findMany({
      where: {
        startsAt: {
          gte: new Date(now - span),
          lte: new Date(now + span),
        },
      },
      select: { gigId: true },
      distinct: ["gigId"],
    });

    return ctx.db.gig.findMany({
      where: { id: { in: items.map((row) => row.gigId) } },
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
