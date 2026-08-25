import type { GigScheduleKind } from "~Prisma/browser";

/**
 * The run sheet, as pure functions.
 *
 * Everything here is total and side-effect free so the admin editor, the app
 * and the cron sweep all agree on what a run sheet means without any of them
 * owning the answer. The interesting parts:
 *
 *   * **Order** is derived, not stored twice. Timed rows run in time order;
 *     rows with no time keep their manual order after them. A gig that only
 *     ever had a line-up typed into it has no times at all, so it sorts exactly
 *     as the old line-up did.
 *   * **Changeovers are not rows.** A set with an earlier set in front of it
 *     implies one. Nobody has to remember to move a changeover when a set time
 *     moves, because there is nothing to move.
 *   * **Cues are derived from `leadMinutes` plus the cue itself.** The sweep
 *     never invents a time; it asks this for the list and checks it against a
 *     window.
 */

/** Everything on the run sheet happens in one place, and it is this one. */
export const RUN_SHEET_TIMEZONE = "Pacific/Auckland";

export type ScheduleKindMeta = {
  kind: GigScheduleKind;
  label: string;
  /** What a new row of this kind warns at, in minutes before. */
  defaultLeadMinutes: number[];
};

export const SCHEDULE_KINDS = [
  { kind: "LOAD_IN", label: "Load-in", defaultLeadMinutes: [15] },
  { kind: "SOUND_CHECK", label: "Sound check", defaultLeadMinutes: [15] },
  { kind: "DOORS", label: "Doors", defaultLeadMinutes: [15] },
  { kind: "SET", label: "Set", defaultLeadMinutes: [5] },
  { kind: "CURFEW", label: "Curfew", defaultLeadMinutes: [15] },
  { kind: "CUSTOM", label: "Cue", defaultLeadMinutes: [5] },
] as const satisfies readonly ScheduleKindMeta[];

export function kindLabel(kind: GigScheduleKind): string {
  return SCHEDULE_KINDS.find((meta) => meta.kind === kind)?.label ?? "Cue";
}

export function defaultLeadMinutes(kind: GigScheduleKind): number[] {
  return [
    ...(SCHEDULE_KINDS.find((meta) => meta.kind === kind)?.defaultLeadMinutes ??
      [5]),
  ];
}

/**
 * The parts of a night.
 *
 * Presentational, and derived rather than stored: a kind already says which
 * part of the night it belongs to. The exception is `CUSTOM`, which has no
 * inherent home and takes the group of the row in front of it — so adding
 * "anything else" under a heading puts it under that heading, and dragging it
 * somewhere else moves it.
 */
export const SCHEDULE_GROUPS = [
  { group: "BEFORE", label: "Before doors", kinds: ["LOAD_IN", "SOUND_CHECK"] },
  { group: "DOORS", label: "Doors", kinds: ["DOORS"] },
  { group: "SHOW", label: "Show", kinds: ["SET"] },
  { group: "AFTER", label: "After", kinds: ["CURFEW"] },
] as const;

export type ScheduleGroup = (typeof SCHEDULE_GROUPS)[number]["group"];

export function groupOfKind(kind: GigScheduleKind): ScheduleGroup | null {
  return (
    SCHEDULE_GROUPS.find((entry) =>
      (entry.kinds as readonly string[]).includes(kind),
    )?.group ?? null
  );
}

export type GroupedSchedule<T> = {
  group: ScheduleGroup;
  label: string;
  rows: T[];
}[];

/**
 * Bucket a run sheet into the parts of a night, each bucket in running order.
 *
 * Every group is returned even when empty, because an empty "Before doors" is
 * the prompt to add a sound check.
 */
export function groupSchedule<
  T extends Pick<ScheduleRow, "kind" | "startsAt" | "sortOrder">,
>(rows: readonly T[]): GroupedSchedule<T> {
  const buckets = new Map<ScheduleGroup, T[]>(
    SCHEDULE_GROUPS.map((entry) => [entry.group, []]),
  );

  let current: ScheduleGroup = "BEFORE";
  for (const row of sortSchedule(rows)) {
    current = groupOfKind(row.kind) ?? current;
    buckets.get(current)?.push(row);
  }

  return SCHEDULE_GROUPS.map((entry) => ({
    group: entry.group,
    label: entry.label,
    rows: buckets.get(entry.group) ?? [],
  }));
}

/**
 * The grouped order, flattened. This is the order `sortOrder` is written from,
 * so what is saved is what was on screen.
 */
export function flattenGroups<T>(grouped: GroupedSchedule<T>): T[] {
  return grouped.flatMap((entry) => entry.rows);
}

/** The least a row needs for ordering and for naming itself. */
export type ScheduleRow = {
  id: string;
  kind: GigScheduleKind;
  label: string | null;
  role: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  sortOrder: number;
  /** Minutes before `startsAt` to warn. Empty warns only on the cue itself. */
  leadMinutes: number[];
  creatorProfile: { displayName: string } | null;
};

/**
 * Display and running order: timed rows by time, untimed rows after them in the
 * order somebody dragged them into.
 *
 * `sortOrder` breaks ties, so two cues sharing a minute stay put rather than
 * swapping about between renders.
 */
export function sortSchedule<T extends Pick<ScheduleRow, "startsAt" | "sortOrder">>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => {
    const at = a.startsAt?.getTime();
    const bt = b.startsAt?.getTime();
    if (at !== undefined && bt !== undefined && at !== bt) return at - bt;
    if (at !== undefined && bt === undefined) return -1;
    if (at === undefined && bt !== undefined) return 1;
    return a.sortOrder - b.sortOrder;
  });
}

/**
 * What a row calls itself in a notification.
 *
 * A hand-typed `label` always wins, so a second door can be "Side door" rather
 * than a second row called "Doors".
 */
export function rowName(row: ScheduleRow): string {
  const label = row.label?.trim();
  if (label) return label;
  if (row.kind === "SET") {
    return row.creatorProfile?.displayName ?? "Set";
  }
  return kindLabel(row.kind);
}

export function formatCueTime(
  at: Date,
  timeZone: string = RUN_SHEET_TIMEZONE,
): string {
  return new Intl.DateTimeFormat("en-NZ", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  })
    .format(at)
    .toLowerCase();
}

/** One notification the run sheet owes somebody, and when it is owed. */
export type Cue = {
  itemId: string;
  /** Minutes before the cue. 0 is the cue itself. */
  offsetMinutes: number;
  dueAt: Date;
  /** The item time this was derived from, recorded so a moved night is visible. */
  firedFor: Date;
  title: string;
  body: string;
};

type CuePhrases = {
  lead: (name: string, minutes: number) => string;
  now: (name: string) => string;
};

/**
 * Spelled out per kind rather than templated, because English does not
 * template: "Load-in in 15 min" and "Doors open" are both right and no single
 * pattern produces them both.
 */
const PHRASES: Record<GigScheduleKind, CuePhrases> = {
  LOAD_IN: { lead: (_, m) => `Load-in in ${m} min`, now: () => "Load-in now" },
  SOUND_CHECK: {
    lead: (_, m) => `Sound check in ${m} min`,
    now: () => "Sound check now",
  },
  DOORS: { lead: (_, m) => `Doors in ${m} min`, now: () => "Doors open" },
  SET: { lead: (name, m) => `${name} on in ${m} min`, now: (name) => `${name} on now` },
  CURFEW: { lead: (_, m) => `Curfew in ${m} min`, now: () => "Curfew now" },
  CUSTOM: { lead: (name, m) => `${name} in ${m} min`, now: (name) => `${name} now` },
};

/** A labelled row is named by its label, so it phrases like a custom cue. */
function phrasesFor(row: ScheduleRow): CuePhrases {
  if (row.kind === "SET") return PHRASES.SET;
  return row.label?.trim() ? PHRASES.CUSTOM : PHRASES[row.kind];
}

/**
 * Every cue a run sheet implies, in due order.
 *
 * Rows with no `startsAt` produce nothing: a line-up with no times is not a
 * schedule and has nothing to announce. A lead of 0, or a duplicate lead, is
 * folded into the single on-the-cue notification rather than sending twice.
 */
export function cuesFor(
  rows: readonly ScheduleRow[],
  {
    gigTitle,
    timeZone = RUN_SHEET_TIMEZONE,
  }: { gigTitle: string; timeZone?: string },
): Cue[] {
  const ordered = sortSchedule(rows);
  const cues: Cue[] = [];

  ordered.forEach((row, index) => {
    const startsAt = row.startsAt;
    if (!startsAt) return;

    const previousSet =
      row.kind === "SET"
        ? findPreviousSet(ordered, index)
        : null;

    const name = rowName(row);
    const phrases = phrasesFor(row);
    const at = formatCueTime(startsAt, timeZone);

    const offsets = new Set<number>([0]);
    for (const lead of row.leadMinutes) {
      if (Number.isInteger(lead) && lead > 0) offsets.add(lead);
    }

    for (const offsetMinutes of offsets) {
      const isChangeover = previousSet !== null;
      const outgoing = previousSet ? rowName(previousSet) : null;

      const title =
        offsetMinutes === 0
          ? isChangeover
            ? `Changeover: ${name} on`
            : phrases.now(name)
          : isChangeover
            ? `Changeover in ${offsetMinutes} min`
            : phrases.lead(name, offsetMinutes);

      const detail =
        offsetMinutes === 0
          ? isChangeover
            ? `${outgoing} off, ${name} on.`
            : `${at}.`
          : isChangeover
            ? `${outgoing} off, ${name} on at ${at}.`
            : `${at}.`;

      cues.push({
        itemId: row.id,
        offsetMinutes,
        dueAt: new Date(startsAt.getTime() - offsetMinutes * 60_000),
        firedFor: startsAt,
        title,
        body: `${detail} ${gigTitle}.`,
      });
    }
  });

  return cues.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}

/** The set immediately in front of this one, if the night has one. */
function findPreviousSet(
  ordered: readonly ScheduleRow[],
  index: number,
): ScheduleRow | null {
  for (let i = index - 1; i >= 0; i -= 1) {
    const candidate = ordered[i];
    if (candidate?.kind === "SET") return candidate;
  }
  return null;
}

/**
 * How far past due a cue can be and still be worth sending.
 *
 * Without a bound, a scheduler that goes down at 9pm delivers the entire night
 * at once when it comes back at 2am, which is worse than silence. Past this,
 * the sweep records the cue as handled and moves on.
 */
export const CATCH_UP_MINUTES = 10;

/** A little slack forward, so a cue is never missed between two pings. */
const LOOKAHEAD_SECONDS = 30;

export type CueWindow = { due: Cue[]; stale: Cue[] };

/**
 * Split cues into the ones this sweep should send and the ones it should write
 * off. Anything still in the future is neither, and is left for a later run.
 */
export function classifyCues(
  cues: readonly Cue[],
  now: Date,
  catchUpMinutes: number = CATCH_UP_MINUTES,
): CueWindow {
  const ceiling = now.getTime() + LOOKAHEAD_SECONDS * 1000;
  const floor = now.getTime() - catchUpMinutes * 60_000;

  const due: Cue[] = [];
  const stale: Cue[] = [];

  for (const cue of cues) {
    const at = cue.dueAt.getTime();
    if (at > ceiling) continue;
    if (at >= floor) due.push(cue);
    else stale.push(cue);
  }

  return { due, stale };
}

/**
 * Shift every row that has not fired yet by `minutes`, for a night running
 * late. Rows already announced keep their times: a notification that has landed
 * on somebody's phone is history, and rewriting it to match the new plan would
 * only make the run sheet disagree with what people were told.
 */
export function shiftSchedule<
  T extends { startsAt: Date | null; endsAt: Date | null },
>(rows: readonly T[], minutes: number, hasFired: (row: T) => boolean): T[] {
  const delta = minutes * 60_000;
  return rows.map((row) => {
    if (hasFired(row)) return row;
    return {
      ...row,
      startsAt: row.startsAt ? new Date(row.startsAt.getTime() + delta) : null,
      endsAt: row.endsAt ? new Date(row.endsAt.getTime() + delta) : null,
    };
  });
}
