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

/**
 * Reading a typed time.
 *
 * Returns every reading that is plausible, best first, because "9:30" is two
 * times and guessing silently is how a set gets announced twelve hours out. The
 * field shows the alternatives and commits the first one, so a wrong guess is
 * visible in the field and one click from being fixed.
 *
 * The rules, in the order they apply:
 *
 *   * An explicit `am` or `pm` settles it.
 *   * An hour of 13 or more settles it, and so does a leading zero — somebody
 *     typing `01:00` is typing 24-hour time and means one in the morning.
 *   * `12` is noon before midnight.
 *   * Anything else is offered as the evening first. Gig nights are evenings,
 *     and a load-in at ten in the morning is two more keystrokes.
 */
export function parseClock(raw: string): number[] {
  const text = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!text) return [];
  if (text === "noon" || text === "midday") return [12 * 60];
  if (text === "midnight") return [0];

  const match = /^(\d{1,2})[:.]?(\d{2})?(am?|pm?)?$/.exec(text);
  if (!match) return [];

  const hourText = match[1]!;
  const hour = Number(hourText);
  const minutes = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3]?.startsWith("p")
    ? "pm"
    : match[3]
      ? "am"
      : null;

  if (hour > 23 || minutes > 59) return [];

  if (meridiem) {
    if (hour === 0 || hour > 12) return [];
    const base = hour === 12 ? 0 : hour * 60;
    return [base + minutes + (meridiem === "pm" ? 12 * 60 : 0)];
  }

  // 24-hour, said plainly.
  const isTwentyFourHour =
    hour === 0 || hour > 12 || hourText.startsWith("0");
  if (isTwentyFourHour) return [hour * 60 + minutes];

  if (hour === 12) return [12 * 60 + minutes, minutes];

  return [(hour + 12) * 60 + minutes, hour * 60 + minutes];
}

/** The reading a field commits to. Null if what was typed is not a time. */
export function parseTimeOfDay(raw: string): number | null {
  return parseClock(raw)[0] ?? null;
}

/** Minutes past midnight, for a moment. */
export function minutesOfDay(at: Date): number {
  return at.getHours() * 60 + at.getMinutes();
}

/** "9:30 pm". The one way a time is written in the admin. */
export function formatClock(minutesPastMidnight: number): string {
  const wrapped = ((minutesPastMidnight % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hour = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  const meridiem = hour < 12 ? "am" : "pm";
  const shown = hour % 12 === 0 ? 12 : hour % 12;
  return `${shown}:${String(minutes).padStart(2, "0")} ${meridiem}`;
}

/**
 * Every time on the clock at a given spacing, for the list behind the field.
 *
 * Starts at midnight rather than at the start of a night, because the list is a
 * clock and a clock starts at twelve.
 */
export function clockOptions(stepMinutes: number): number[] {
  const options: number[] = [];
  for (let minutes = 0; minutes < MINUTES_PER_DAY; minutes += stepMinutes) {
    options.push(minutes);
  }
  return options;
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
