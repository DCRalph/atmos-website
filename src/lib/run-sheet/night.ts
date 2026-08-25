/**
 * Times on a run sheet, which are times of night rather than times of day.
 *
 * A run sheet is typed as clock times: doors 20:00, curfew 01:00. The curfew is
 * the next calendar day and nobody wants to say so. So a time is resolved
 * against the gig's night, and a night runs from `NIGHT_ROLLOVER_HOUR` to the
 * same hour the following day.
 *
 * All of this is local time on purpose. An admin typing 20:00 means 20:00 where
 * the gig is, and the venue and the person typing are in the same place. The
 * stored value is an absolute moment, so the sweep and the app never have to
 * think about any of it.
 */

/** Before this hour is still the night before. */
export const NIGHT_ROLLOVER_HOUR = 6;

const MINUTES_PER_DAY = 24 * 60;

/** "22:15" or "2215" or "9:05" to minutes past midnight. Null if it is not a time. */
export function parseTimeOfDay(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;

  const match = /^(\d{1,2})[:.\s]?(\d{2})$/.exec(text);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

/** The clock face, for putting a stored moment back in the input. */
export function formatTimeOfDay(at: Date): string {
  return `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
}

/** Midnight starting the night a gig belongs to. */
export function nightStart(gigStart: Date): Date {
  const date = new Date(gigStart);
  if (date.getHours() < NIGHT_ROLLOVER_HOUR) {
    date.setDate(date.getDate() - 1);
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * The moment a typed clock time means, on this gig's night.
 *
 * `01:00` on a Friday night is Saturday morning, which is the whole reason this
 * function exists rather than a date field on every row.
 */
export function resolveNightTime(gigStart: Date, minutesOfDay: number): Date {
  const at = nightStart(gigStart);
  if (minutesOfDay < NIGHT_ROLLOVER_HOUR * 60) {
    at.setDate(at.getDate() + 1);
  }
  at.setMinutes(minutesOfDay);
  return at;
}

/** Whether a resolved time landed on the morning after. Shown, never guessed at. */
export function rollsOver(gigStart: Date, at: Date): boolean {
  return at.getDate() !== nightStart(gigStart).getDate();
}

/**
 * Whole days between two nights.
 *
 * Counted in calendar days rather than milliseconds because New Zealand has
 * daylight saving, and a gig moved across the change would otherwise land an
 * hour out.
 */
export function nightsBetween(from: Date, to: Date): number {
  const a = nightStart(from);
  const b = nightStart(to);
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Move a run sheet with its gig.
 *
 * When the gig's date changes, every row has to follow, or a night moved from
 * Friday to Saturday keeps announcing itself on Friday. Times of night are
 * preserved: a 01:00 curfew stays 01:00.
 */
export function rebaseSchedule<
  T extends { startsAt: Date | null; endsAt: Date | null },
>(rows: readonly T[], from: Date, to: Date): T[] {
  const days = nightsBetween(from, to);
  if (days === 0) return [...rows];

  const shift = (at: Date | null): Date | null => {
    if (!at) return null;
    const moved = new Date(at);
    moved.setDate(moved.getDate() + days);
    return moved;
  };

  return rows.map((row) => ({
    ...row,
    startsAt: shift(row.startsAt),
    endsAt: shift(row.endsAt),
  }));
}

/** Minutes from one time of night to the next, for showing a gap. */
export function minutesBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 60_000) % (MINUTES_PER_DAY * 2);
}
