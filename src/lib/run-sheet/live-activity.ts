/**
 * The run sheet, as a Live Activity.
 *
 * One derivation, three readers: the app starts and updates the activity from
 * it, the cron sweep decides from it when a phone needs waking, and the sweep
 * puts its result straight into the push so the widget can be moved on without
 * the app fetching anything. Two implementations of "what is on right now" is
 * one too many — a lock screen that disagrees with the run sheet screen is
 * worse than no lock screen at all.
 *
 * Everything here is pure, and everything the lock screen shows is either a
 * name or a pair of instants. That is deliberate: SwiftUI renders
 * `Text(timerInterval:)` and `ProgressView(timerInterval:)` from dates without
 * anything running, so between one item and the next the countdown and the
 * progress bar stay live on a locked handset at no cost. Only the *names* need
 * a push, and names only change when an item does.
 */

import { rowName, sortSchedule, type ScheduleRow } from "./schedule";

/** How long before the first item the activity appears, counting down to it. */
export const LEAD_IN_MINUTES = 60;

/**
 * How long a final item with no end time is treated as running for.
 *
 * A curfew is an instant rather than a span, and it is usually the last row of
 * the night, so without this the activity would sit on the lock screen until
 * somebody dismissed it by hand.
 */
export const TAIL_MINUTES = 15;

/** A run sheet row, reduced to what a lock screen can show. */
export type LiveRow = {
  name: string;
  startsAt: Date;
  /** As typed. Absent is normal — most rows run until the next one starts. */
  endsAt: Date | null;
};

export type ActivityGig = {
  id: string;
  title: string;
  rows: readonly LiveRow[];
};

/** What the lock screen shows. `current` is absent before and between items. */
export type RunSheetActivity = {
  gigId: string;
  gigTitle: string;
  /** What is on now. The progress bar runs `startsAt` to `endsAt`. */
  current: { name: string; startsAt: Date; endsAt: Date } | null;
  /** What is on next. The countdown runs to `startsAt`. */
  next: { name: string; startsAt: Date } | null;
  /**
   * The night end to end, for the second bar: how far through the whole thing
   * we are, under how far through this item we are.
   *
   * The first row to the last, so a load-in at two in the afternoon is part of
   * the night rather than the night starting at doors. That is what is on the
   * run sheet screen, and the two should not measure different things.
   */
  show: { startsAt: Date; endsAt: Date };
};

/** Timed rows in running order. A row with no time is not part of a schedule. */
function timed(rows: readonly LiveRow[]): LiveRow[] {
  return rows
    .filter((row): row is LiveRow => row.startsAt instanceof Date)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/**
 * When a row is over.
 *
 * A typed end wins. Otherwise a row runs until the next one starts, which is
 * what a run sheet means by an untimed end and what makes the progress bar span
 * a changeover rather than stopping dead at the end of a set. The last row of
 * the night has neither, so it gets `TAIL_MINUTES`.
 */
function endOf(rows: readonly LiveRow[], index: number): Date {
  const row = rows[index];
  if (!row) throw new Error(`no row at ${index}`);
  if (row.endsAt) return row.endsAt;
  const next = rows[index + 1];
  if (next) return next.startsAt;
  return new Date(row.startsAt.getTime() + TAIL_MINUTES * 60_000);
}

/**
 * What the lock screen should be showing, or `null` for nothing at all —
 * the night is more than an hour away, or it is over.
 *
 * Three shapes come out of this, and the widget tells them apart by whether
 * `current` is set:
 *
 *   * **Waiting.** Nothing has started. `next` is the first item, and the
 *     countdown to it is the whole point of the activity existing this early.
 *   * **Running.** An item is on. It has a span, so it has a progress bar, and
 *     `next` is what follows it.
 *   * **In a gap.** An item has ended and the next has not started, which only
 *     happens when somebody typed an end time earlier than the next start. Same
 *     shape as waiting.
 */
export function runSheetActivity(
  gig: ActivityGig,
  now: Date,
): RunSheetActivity | null {
  const rows = timed(gig.rows);
  const first = rows[0];
  if (!first) return null;

  const at = now.getTime();
  if (at < first.startsAt.getTime() - LEAD_IN_MINUTES * 60_000) return null;

  // The last row whose start has been reached. -1 before the night begins.
  let index = -1;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (row && row.startsAt.getTime() <= at) index = i;
    else break;
  }

  const upcoming = rows[index + 1];
  const next = upcoming
    ? { name: upcoming.name, startsAt: upcoming.startsAt }
    : null;

  const head = {
    gigId: gig.id,
    gigTitle: gig.title,
    show: { startsAt: first.startsAt, endsAt: endOf(rows, rows.length - 1) },
  };

  if (index === -1) return { ...head, current: null, next };

  const row = rows[index];
  if (!row) return null;
  const endsAt = endOf(rows, index);

  // Over. Either there is something to look forward to, or the night is done
  // and the activity has no reason to stay on the lock screen.
  if (at >= endsAt.getTime()) {
    if (!next) return null;
    return { ...head, current: null, next };
  }

  return {
    ...head,
    current: { name: row.name, startsAt: row.startsAt, endsAt },
    next,
  };
}

/**
 * Every instant at which `runSheetActivity` starts saying something new.
 *
 * This is what the sweep watches. Between two of these the lock screen is
 * already correct without anybody touching it, so a push at any other minute
 * would spend one of iOS's small budget of background wake-ups to change
 * nothing.
 *
 * Derived from the same two rules as the state above — the lead-in, and each
 * row's start and end — rather than listed by hand, so a new shape of night
 * cannot be right on the screen and unwatched by the sweep.
 */
export function activityMoments(rows: readonly LiveRow[]): Date[] {
  const ordered = timed(rows);
  const first = ordered[0];
  if (!first) return [];

  const moments = new Set<number>([
    first.startsAt.getTime() - LEAD_IN_MINUTES * 60_000,
  ]);
  ordered.forEach((row, index) => {
    moments.add(row.startsAt.getTime());
    moments.add(endOf(ordered, index).getTime());
  });

  return [...moments].sort((a, b) => a - b).map((ms) => new Date(ms));
}

/**
 * The moments that fell in the minute this sweep is answering for.
 *
 * Centred on `now` rather than trailing it, because the sweep runs once a
 * minute: a window of half a minute either side catches every moment exactly
 * once, and catches it as near to the second as a minute-resolution ticker can.
 */
export function momentsDue(
  moments: readonly Date[],
  now: Date,
  windowSeconds = 30,
): Date[] {
  const from = now.getTime() - windowSeconds * 1000;
  const to = now.getTime() + windowSeconds * 1000;
  return moments.filter(
    (moment) => moment.getTime() >= from && moment.getTime() < to,
  );
}

/**
 * The activity flattened to what actually crosses a wire.
 *
 * The same shape goes down the push and across the native bridge, so the
 * widget is fed identically whether the app worked it out or the sweep did.
 * Times are epoch seconds because that is the one representation neither
 * JavaScript nor Swift can misread, and because the widget does arithmetic on
 * them rather than printing them.
 */
export type ActivityPayload = {
  gigId: string;
  gigTitle: string;
  /** False takes the activity down: the night is over, or too far off yet. */
  active: boolean;
  /** What is on now. Null before the first item and in a gap between two. */
  currentName: string | null;
  /** The progress bar's span. Both null exactly when `currentName` is. */
  currentStartsAt: number | null;
  currentEndsAt: number | null;
  /** What the countdown counts to, and what it is called. */
  nextName: string | null;
  nextStartsAt: number | null;
  /** The night end to end, for the second bar. Fixed for the whole activity. */
  showStartsAt: number | null;
  showEndsAt: number | null;
};

const seconds = (at: Date): number => Math.round(at.getTime() / 1000);

export function activityPayload(
  gig: Pick<ActivityGig, "id" | "title">,
  state: RunSheetActivity | null,
): ActivityPayload {
  return {
    gigId: gig.id,
    gigTitle: gig.title,
    active: state !== null,
    currentName: state?.current?.name ?? null,
    currentStartsAt: state?.current ? seconds(state.current.startsAt) : null,
    currentEndsAt: state?.current ? seconds(state.current.endsAt) : null,
    nextName: state?.next?.name ?? null,
    nextStartsAt: state?.next ? seconds(state.next.startsAt) : null,
    showStartsAt: state ? seconds(state.show.startsAt) : null,
    showEndsAt: state ? seconds(state.show.endsAt) : null,
  };
}

/**
 * A run sheet reduced to what a lock screen can show: a name and a span.
 *
 * Named here the same way a cue names itself, because the widget and the
 * notification are describing the same row and must not call it two things.
 */
export function activityRows(rows: readonly ScheduleRow[]): LiveRow[] {
  return sortSchedule(rows).flatMap((row) =>
    row.startsAt
      ? [{ name: rowName(row), startsAt: row.startsAt, endsAt: row.endsAt }]
      : [],
  );
}
