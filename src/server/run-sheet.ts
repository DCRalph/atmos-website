import "server-only";

import { Prisma } from "~Prisma/client";

import { db } from "~/server/db";
import { publish } from "~/server/notify";
import {
  CATCH_UP_MINUTES,
  classifyCues,
  cuesFor,
  type Cue,
  type ScheduleRow,
} from "~/lib/run-sheet/schedule";

/**
 * The run sheet sweep.
 *
 * Called every minute by an external scheduler through
 * `/api/cron/run-sheet`. Everything about *what* to send lives in
 * `~/lib/run-sheet/schedule.ts`; this is the part that talks to the database.
 *
 * Two rules keep it honest on a bad night:
 *
 *  - **The fire row is written before the push, not after.** `gig_schedule_fire`
 *    is unique on (item, offset), so two overlapping pings race to insert and
 *    the loser sends nothing. Reserving after sending would leave the window
 *    open for a duplicate; reserving first means the worst case is a cue that
 *    is dropped rather than one that arrives twice at 11pm.
 *  - **Overdue cues are written off, not delivered late.** See
 *    `CATCH_UP_MINUTES`. A scheduler that dies at 9pm must not deliver the whole
 *    night at 2am.
 */

/** How far either side of now a gig has to be for its cues to be considered. */
const GIG_WINDOW_HOURS = 24;

export type SweepResult = {
  gigs: number;
  sent: number;
  /** Cues too far overdue, or with nobody to tell. Recorded, not delivered. */
  written_off: number;
};

export async function sweepRunSheets(now = new Date()): Promise<SweepResult> {
  const span = GIG_WINDOW_HOURS * 60 * 60 * 1000;
  const gigIds = await gigsWithCuesNear(new Date(now.getTime() - span), new Date(now.getTime() + span));

  const result: SweepResult = { gigs: gigIds.length, sent: 0, written_off: 0 };

  for (const gigId of gigIds) {
    const gig = await loadRunSheet(gigId);
    if (!gig) continue;

    const rows: ScheduleRow[] = gig.scheduleItems.map(toScheduleRow);
    const { due, stale } = classifyCues(
      cuesFor(rows, { gigTitle: gig.title }),
      now,
      CATCH_UP_MINUTES,
    );

    const fallback = gig.notifyRecipients.map((row) => row.userId);
    const overrides = new Map(
      gig.scheduleItems.map((item) => [
        item.id,
        item.recipients.map((row) => row.userId),
      ]),
    );

    for (const cue of stale) {
      if (await writeOff(cue)) result.written_off += 1;
    }

    for (const cue of due) {
      const picked = overrides.get(cue.itemId) ?? [];
      const userIds = picked.length > 0 ? picked : fallback;

      // Nobody to tell. Recorded anyway, so the sweep does not reconsider this
      // cue every minute for the next day.
      if (userIds.length === 0) {
        if (await writeOff(cue)) result.written_off += 1;
        continue;
      }

      const fire = await reserve(cue);
      if (!fire) continue;

      const message = await publish(
        {
          topic: RUN_SHEET_TOPIC,
          title: cue.title,
          message: cue.body,
          priority: 4,
          tags: ["run-sheet"],
          click: `/run-sheet/${gigId}`,
        },
        { source: "run-sheet", audience: { kind: "users", userIds } },
      );

      await db.gigScheduleFire.update({
        where: { id: fire.id },
        data: {
          devices: message.delivery.devices,
          delivered: message.delivery.delivered,
          notifyMessageId: message.id,
        },
      });
      result.sent += 1;
    }
  }

  return result;
}

/**
 * The topic run sheet cues are logged under.
 *
 * Deliberately absent from `KNOWN_TOPICS`: nobody subscribes to it and nobody
 * should compose to it by hand, because the audience is the people an admin
 * picked for the gig. It exists so these land in the same notification history
 * as everything else the site sends.
 */
export const RUN_SHEET_TOPIC = "run-sheet";

/** Reserves the cue, or returns null because somebody else already had it. */
async function reserve(cue: Cue): Promise<{ id: string } | null> {
  try {
    return await db.gigScheduleFire.create({
      data: {
        itemId: cue.itemId,
        offsetMinutes: cue.offsetMinutes,
        firedFor: cue.firedFor,
      },
      select: { id: true },
    });
  } catch (cause) {
    if (
      cause instanceof Prisma.PrismaClientKnownRequestError &&
      cause.code === "P2002"
    ) {
      return null;
    }
    throw cause;
  }
}

/** Records a cue as handled without sending it. */
async function writeOff(cue: Cue): Promise<boolean> {
  try {
    await db.gigScheduleFire.create({
      data: {
        itemId: cue.itemId,
        offsetMinutes: cue.offsetMinutes,
        firedFor: cue.firedFor,
        skipped: true,
      },
    });
    return true;
  } catch (cause) {
    if (
      cause instanceof Prisma.PrismaClientKnownRequestError &&
      cause.code === "P2002"
    ) {
      return false;
    }
    throw cause;
  }
}

/**
 * Gigs with anything scheduled nearby, found from the items rather than from
 * `gigStartTime` — a load-in is hours before the gig "starts" and a curfew is
 * after it ends.
 */
async function gigsWithCuesNear(from: Date, to: Date): Promise<string[]> {
  const rows = await db.gigScheduleItem.findMany({
    where: { startsAt: { gte: from, lte: to } },
    select: { gigId: true },
    distinct: ["gigId"],
  });
  return rows.map((row) => row.gigId);
}

const RUN_SHEET_INCLUDE = {
  scheduleItems: {
    include: {
      creatorProfile: { select: { displayName: true } },
      recipients: { select: { userId: true } },
    },
  },
  notifyRecipients: { select: { userId: true } },
} satisfies Prisma.GigInclude;

type LoadedGig = Prisma.GigGetPayload<{ include: typeof RUN_SHEET_INCLUDE }>;

/** The whole run sheet, because a changeover is defined by its neighbour. */
async function loadRunSheet(gigId: string): Promise<LoadedGig | null> {
  return db.gig.findUnique({ where: { id: gigId }, include: RUN_SHEET_INCLUDE });
}

export function toScheduleRow(
  item: LoadedGig["scheduleItems"][number],
): ScheduleRow {
  return {
    id: item.id,
    kind: item.kind,
    label: item.label,
    role: item.role,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    sortOrder: item.sortOrder,
    leadMinutes: item.leadMinutes,
    creatorProfile: item.creatorProfile,
  };
}
