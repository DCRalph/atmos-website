import type { z } from "zod";
import {
  WEEKDAY_KEYS,
  type playbookItemSchema,
  type playbookRoleSchema,
  type playbookWhenSchema,
} from "./input";
import { projectSchedule, type Dependency } from "./schedule";
import { addDays, dayKey, nzDate, nzParts, startOfWeek } from "./time";

/**
 * How a playbook reads and where its tasks land. A task says when it's due
 * as a rule counted from the gig (see `playbookWhenSchema`), and these turn
 * that rule into a date for a real gig, in NZ time. The editor, the apply
 * preview and applying all use them, so what's shown is what gets made.
 */

export type PlaybookItem = z.input<typeof playbookItemSchema>;
export type PlaybookTask = z.output<typeof playbookItemSchema>;
export type PlaybookRole = z.output<typeof playbookRoleSchema>;
export type PlaybookWhen = z.output<typeof playbookWhenSchema>;
export type Weekday = (typeof WEEKDAY_KEYS)[number];

/** The times a gig gives a playbook to count from. Doors and end fall back to the start. */
export type PlaybookGig = {
  startsAt: Date;
  doorsAt?: Date | null;
  endsAt?: Date | null;
};

/** The roles a new playbook starts with. */
export const DEFAULT_PLAYBOOK_ROLES = ["lead", "promo", "design", "production"];

export const WEEKDAY_NAMES: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const HOURS_FROM = { start: "the start", doors: "doors", end: "close" };

/** Monday is 0, for a `2026-12-12` day key. */
export function weekdayIndex(day: string) {
  return (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
}

/** Whole days from one day key to another. */
export function daysBetween(from: string, to: string) {
  return Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
      86_400_000,
  );
}

/** How many days from the gig's date a days or weekday rule lands. */
function ruleDays(
  when: Exclude<PlaybookWhen, { kind: "hours" }>,
  gigWeekday: number,
) {
  if (when.kind === "days") return when.days;
  const day = WEEKDAY_KEYS.indexOf(when.day);
  const first =
    (when.side === "before" ? gigWeekday - day : day - gigWeekday) + 7;
  const days = (first % 7 || 7) + when.weeks * 7;
  return when.side === "before" ? -days : days;
}

/** `[17, 0]` for `17:00`. */
function clock(time: string) {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return [hour, minute] as const;
}

/** `5:00 pm` for `17:00`. */
export function formatClock(time: string) {
  const [hour, minute] = clock(time);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "am" : "pm"}`;
}

/**
 * When a playbook task falls due for a gig. Days and weekday rules land on
 * a calendar day in NZ at the task's time, else the playbook's, else the
 * gig's own start time. `movedFrom` is the weekend day a weekdays-only task
 * moved off.
 */
export function playbookDueAt(
  task: Pick<PlaybookTask, "when" | "time">,
  gig: PlaybookGig,
  dueTime: string | null,
) {
  const { when } = task;
  if (when.kind === "hours") {
    const from =
      when.from === "doors"
        ? gig.doorsAt
        : when.from === "end"
          ? gig.endsAt
          : null;
    return {
      dueAt: new Date(
        (from ?? gig.startsAt).getTime() + Math.round(when.hours * 60) * 60_000,
      ),
      movedFrom: null,
    };
  }
  const gigDay = dayKey(gig.startsAt);
  let day = addDays(gigDay, ruleDays(when, weekdayIndex(gigDay)));
  let movedFrom: string | null = null;
  const weekday = weekdayIndex(day);
  if (when.kind === "days" && when.weekdays && weekday >= 5) {
    movedFrom = day;
    day = addDays(day, when.days > 0 ? 7 - weekday : 4 - weekday);
  }
  const time = task.time ?? dueTime;
  const start = nzParts(gig.startsAt);
  const [hour, minute] = time ? clock(time) : [start.hour, start.minute];
  return { dueAt: nzDate(day, hour, minute), movedFrom };
}

/** Each task's due date for a gig, by key. */
export function playbookDueDates(
  playbook: {
    dueTime: string | null;
    tasks: readonly Pick<PlaybookTask, "key" | "when" | "time">[];
  },
  gig: PlaybookGig,
) {
  return new Map(
    playbook.tasks.map((task) => [
      task.key,
      playbookDueAt(task, gig, playbook.dueTime),
    ]),
  );
}

/**
 * The same kind of rule, moved so it lands on `day` for this gig: what
 * dragging a task to another day does. A weekday rule dropped on the gig day
 * becomes a day count, since a weekday rule never lands there.
 */
export function moveWhen(
  task: Pick<PlaybookTask, "when" | "time">,
  day: string,
  gig: PlaybookGig,
  dueTime: string | null,
): PlaybookWhen {
  const { when } = task;
  const gigDay = dayKey(gig.startsAt);
  const offset = daysBetween(gigDay, day);
  if (when.kind === "hours") {
    const current = dayKey(playbookDueAt(task, gig, dueTime).dueAt);
    return { ...when, hours: when.hours + 24 * daysBetween(current, day) };
  }
  if (when.kind === "days" || offset === 0) {
    const weekdays =
      when.kind === "days" && when.weekdays && weekdayIndex(day) < 5;
    return {
      kind: "days",
      days: Math.min(30, Math.max(-365, offset)),
      ...(weekdays ? { weekdays } : {}),
    };
  }
  const moved = {
    kind: "weekday" as const,
    day: WEEKDAY_KEYS[weekdayIndex(day)]!,
    side: offset < 0 ? ("before" as const) : ("after" as const),
    weeks: 0,
  };
  const first = Math.abs(ruleDays(moved, weekdayIndex(gigDay)));
  return { ...moved, weeks: (Math.abs(offset) - first) / 7 };
}

/** A rule as you'd say it: `Mon before`, `Wed, 3 weeks before`, `6 weeks before`, `2 hours before doors`. */
export function formatWhen(when: PlaybookWhen) {
  if (when.kind === "hours") {
    const hours = Number(Math.abs(when.hours).toFixed(2));
    if (hours === 0) return `At ${HOURS_FROM[when.from]}`;
    return `${hours} ${hours === 1 ? "hour" : "hours"} ${when.hours < 0 ? "before" : "after"} ${HOURS_FROM[when.from]}`;
  }
  if (when.kind === "weekday") {
    const day = WEEKDAY_NAMES[when.day].slice(0, 3);
    return when.weeks === 0
      ? `${day} ${when.side}`
      : `${day}, ${when.weeks} ${when.weeks === 1 ? "week" : "weeks"} ${when.side}`;
  }
  const days = Math.abs(when.days);
  const side = when.days < 0 ? "before" : "after";
  const text =
    days === 0
      ? "Gig day"
      : days === 1
        ? `Day ${side}`
        : days % 7 === 0
          ? `${days / 7} ${days === 7 ? "week" : "weeks"} ${side}`
          : `${days} days ${side}`;
  return when.weekdays ? `${text} · weekdays` : text;
}

/** The rule with the task's own time, when it has one: `Wed, 3 weeks before · 6:00 pm`. */
export function formatTaskWhen(task: Pick<PlaybookTask, "when" | "time">) {
  const text = formatWhen(task.when);
  return task.time && task.when.kind !== "hours"
    ? `${text} · ${formatClock(task.time)}`
    : text;
}

/**
 * A stand-in gig to lay a playbook out on when there's no real one: the
 * first Friday, Saturday or Sunday at 9pm far enough out that none of its
 * tasks has passed.
 */
export function sampleGig(
  weekday: Weekday,
  tasks: readonly Pick<PlaybookTask, "when">[],
  today: string,
): PlaybookGig {
  const target = WEEKDAY_KEYS.indexOf(weekday);
  const lead = Math.max(
    0,
    ...tasks.map(({ when }) =>
      when.kind === "hours"
        ? Math.ceil(-when.hours / 24)
        : -ruleDays(when, target),
    ),
  );
  let day = addDays(today, lead + 1);
  day = addDays(day, (target - weekdayIndex(day) + 7) % 7);
  return {
    startsAt: nzDate(day, 21),
    doorsAt: nzDate(day, 21),
    endsAt: nzDate(addDays(day, 1), 2),
  };
}

/** Weeks from the gig's week, Monday to Sunday: 0 is gig week, -6 is six weeks out, 1 the week after. */
export function weekFromGig(day: string, gigDay: string) {
  return daysBetween(startOfWeek(gigDay), startOfWeek(day)) / 7;
}

/** `6 weeks out`, `Gig week`, `Week after`. */
export function weekLabel(week: number) {
  if (week === 0) return "Gig week";
  if (week === 1) return "Week after";
  if (week > 1) return `${week} weeks after`;
  return week === -1 ? "1 week out" : `${-week} weeks out`;
}

/** `6 weeks before to Wed after`, from the first task to the last on a Saturday gig. */
export function playbookSpan(tasks: readonly Pick<PlaybookTask, "when">[]) {
  if (tasks.length === 0) return "";
  const gig = sampleGig("sat", tasks, "2026-01-01");
  const sorted = [...tasks].sort(
    (a, b) =>
      playbookDueAt(a, gig, null).dueAt.getTime() -
      playbookDueAt(b, gig, null).dueAt.getTime(),
  );
  const first = formatWhen(sorted[0]!.when);
  const last = formatWhen(sorted.at(-1)!.when);
  return first === last ? first : `${first} to ${last}`;
}

/** Every role a playbook's tasks use, owners and reviewers, in first-use order. */
export function playbookRoles(
  tasks: readonly Pick<PlaybookTask, "role" | "reviewerRole">[],
) {
  return [
    ...new Set(
      tasks.flatMap((task) =>
        [task.role, task.reviewerRole].filter((role): role is string => !!role),
      ),
    ),
  ];
}

/**
 * Renames a role on the playbook and every task that uses it. Renaming to a
 * role that already exists merges the two. A task left reviewing its own
 * work loses the review.
 */
export function renameRole<
  T extends Pick<PlaybookTask, "role" | "reviewerRole">,
>(playbook: { roles: PlaybookRole[]; tasks: T[] }, from: string, to: string) {
  const merge = from !== to && playbook.roles.some((role) => role.name === to);
  return {
    roles: merge
      ? playbook.roles.filter((role) => role.name !== from)
      : playbook.roles.map((role) =>
          role.name === from ? { ...role, name: to } : role,
        ),
    tasks: playbook.tasks.map((task) => {
      const role = task.role === from ? to : task.role;
      const reviewer =
        task.reviewerRole === from ? to : (task.reviewerRole ?? undefined);
      return {
        ...task,
        role,
        reviewerRole: reviewer === role ? undefined : reviewer,
      };
    }),
  };
}

/** Work due by the gig's start cannot slip past it. Wrap-up after it can. */
export function playbookHardDeadline(dueAt: Date, gig: PlaybookGig) {
  return dueAt.getTime() <= gig.startsAt.getTime() ? gig.startsAt : null;
}

/**
 * A playbook's dependencies between its own keys, each with the gap their
 * dates imply for this gig, so a task that waits on another keeps the same
 * distance from it when the first one slips.
 */
export function playbookDependencies(
  tasks: readonly Pick<PlaybookTask, "key" | "dependsOn">[],
  dueAts: Map<string, { dueAt: Date }>,
): Dependency[] {
  const at = (key: string) => dueAts.get(key)?.dueAt.getTime() ?? 0;
  return tasks.flatMap((task) =>
    task.dependsOn.map((key) => ({
      taskId: task.key,
      dependsOnId: key,
      gapMinutes: Math.max(0, Math.round((at(task.key) - at(key)) / 60_000)),
    })),
  );
}

/**
 * What applying a playbook to a gig would make, before anything is written:
 * each task's due date, and where the schedule puts it straight away once
 * anything it waits for is already late. In date order.
 */
export function playbookPlan<
  T extends Pick<PlaybookTask, "key" | "title" | "when" | "time" | "dependsOn">,
>(
  playbook: { dueTime: string | null; tasks: readonly T[] },
  gig: PlaybookGig,
  now: Date,
) {
  const dates = playbookDueDates(playbook, gig);
  const tasks = playbook.tasks.map((task) => {
    const { dueAt } = dates.get(task.key)!;
    return {
      id: task.key,
      title: task.title,
      status: "TODO" as const,
      assigneeId: null,
      dueAt,
      plannedDueAt: dueAt,
      hardDeadlineAt: playbookHardDeadline(dueAt, gig),
      completedAt: null,
      submittedAt: null,
    };
  });
  const projected = projectSchedule(
    tasks,
    playbookDependencies(playbook.tasks, dates),
    now,
  );
  return playbook.tasks
    .map((item) => {
      const { dueAt, movedFrom } = dates.get(item.key)!;
      const projection = projected.get(item.key)!;
      return {
        item,
        dueAt,
        movedFrom,
        /** Later than `dueAt` when something it waits for is already late. */
        projectedAt: projection.projectedDueAt,
        atRisk: projection.atRisk,
      };
    })
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}
