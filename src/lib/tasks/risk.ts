import type { TaskStatus } from "./status";
import { formatTaskDate } from "./time";

/**
 * Why a task is at risk, in words. A task is at risk when the earliest it can
 * realistically be done lands past its hard deadline, usually the gig's
 * start: either its own due date is past it, or something it waits for is
 * late (or due too close) and the gap it needs after that runs over.
 */

export type RiskTask = {
  id: string;
  title: string;
  status: TaskStatus;
  dueAt: Date;
  completedAt: Date | null;
  hardDeadlineAt: Date | null;
  /** The task whose finish sets this one's earliest date, from `projectSchedule`. */
  causeTaskId: string | null;
  /** The earliest this can be done, uncapped by the deadline. */
  requiredDueAt: Date;
  /** How far `requiredDueAt` is past the hard deadline. */
  shortMinutes: number;
  dependencies: readonly { dependsOnId: string; gapMinutes: number }[];
  gig?: { gigStartTime: Date } | null;
};

export type RiskReason = {
  /** For a list cell or the alert strip: `Waits on Poster design (2 days late)`. */
  short: string;
  /** The whole story, for the task drawer and pushes. */
  detail: string;
  /** What it waits on, nearest first, ending at what's actually holding it up. */
  causes: { id: string; title: string }[];
};

/** `1 day 12 hours`, `1 hour 30 minutes`, `40 minutes`: exact, largest first. */
export function formatSpan(minutes: number) {
  const total = Math.max(1, Math.round(minutes));
  const units = [
    [Math.floor(total / 1440), "day"],
    [Math.floor((total % 1440) / 60), "hour"],
    [total % 60, "minute"],
  ] as const;
  return units
    .filter(([count]) => count > 0)
    .map(([count, name]) => `${count} ${name}${count === 1 ? "" : "s"}`)
    .join(" ");
}

/** A span measured from now, to the hour once it's over one: lateness doesn't need minutes. */
const roughly = (minutes: number) =>
  formatSpan(minutes >= 60 ? Math.round(minutes / 60) * 60 : minutes);

export function explainRisk(
  task: RiskTask,
  byId: ReadonlyMap<string, RiskTask>,
  now: Date,
): RiskReason | null {
  const deadline = task.hardDeadlineAt;
  if (!deadline || task.shortMinutes <= 0) return null;

  const gigStart = task.gig?.gigStartTime.getTime() === deadline.getTime();
  const past = `${roughly(task.shortMinutes)} after ${
    gigStart
      ? `the gig starts (${formatTaskDate(deadline)})`
      : `its hard deadline (${formatTaskDate(deadline)})`
  }`;

  // Back through what it waits on, stopping at a finished task: from there it
  // counts from when that was actually done, not from what held it up.
  const causeIds: string[] = [];
  for (
    let id = task.causeTaskId;
    id && byId.has(id) && !causeIds.includes(id);
    id = byId.get(id)!.status === "DONE" ? null : byId.get(id)!.causeTaskId
  )
    causeIds.push(id);

  if (causeIds.length === 0)
    return {
      short: `Due after the ${gigStart ? "gig starts" : "hard deadline"}`,
      detail: `It's due ${formatTaskDate(task.dueAt)}, ${past}. Bring the due date forward.`,
      causes: [],
    };

  const cause = byId.get(causeIds[0]!)!;
  const root = byId.get(causeIds.at(-1)!)!;
  const state = (other: RiskTask) =>
    other.status === "DONE" && other.completedAt
      ? `done ${formatTaskDate(other.completedAt)}`
      : other.dueAt < now
        ? `${roughly((now.getTime() - other.dueAt.getTime()) / 60_000)} late`
        : `due ${formatTaskDate(other.dueAt)}`;
  const short =
    causeIds.length === 1
      ? `Waits on ${cause.title} (${state(cause)})`
      : `Waits on ${cause.title}, held up by ${root.title} (${state(root)})`;
  const gap =
    task.dependencies.find((dep) => dep.dependsOnId === cause.id)?.gapMinutes ??
    0;
  return {
    short,
    detail: `${short}. ${
      gap > 0 ? `It needs ${formatSpan(gap)} after that, so the` : "The"
    } earliest it can be done is ${formatTaskDate(task.requiredDueAt)}, ${past}.`,
    causes: causeIds.map((id) => ({ id, title: byId.get(id)!.title })),
  };
}
