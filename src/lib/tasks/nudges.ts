import { dayKey, addDays, nzDate, nzParts } from "./time";
import type { TaskStatus } from "./status";
const HOUR = 3_600_000;
export type NudgeTask = {
  status: TaskStatus;
  dueAt: Date;
  critical: boolean;
  checkBackAt: Date | null;
  submittedAt: Date | null;
  gigAt?: Date | null;
  waiting: boolean;
  atRisk: boolean;
};
export type NudgeStep = {
  step: string;
  at: Date;
  priority: "normal" | "high";
  allAdmins: boolean;
};
/** Hold quiet-hour reminders until the next 8am, except on the task's gig day. */
export function wakingAt(date: Date, gigAt?: Date | null) {
  if (gigAt && dayKey(date) === dayKey(gigAt)) return date;
  const { hour } = nzParts(date);
  const day = dayKey(date);
  if (hour < 8) return nzDate(day, 8);
  if (hour >= 22) return nzDate(addDays(day, 1), 8);
  return date;
}
export function addWakingHours(from: Date, hours: number, gigAt?: Date | null) {
  let at = wakingAt(from, gigAt);
  let left = hours * HOUR;
  while (left > 0) {
    const day = dayKey(at);
    const gigDay = gigAt && dayKey(gigAt) === day;
    const end = (gigDay ? nzDate(addDays(day, 1)) : nzDate(day, 22)).getTime();
    const available = end - at.getTime();
    if (left <= available) return new Date(at.getTime() + left);
    left -= available;
    at = wakingAt(nzDate(addDays(day, 1)), gigAt);
  }
  return at;
}
/** All elapsed steps, oldest first. The sweep sends only the last and records the rest as skipped. */
export function nudgeSteps(task: NudgeTask, now: Date): NudgeStep[] {
  if (task.waiting || ["PROPOSED", "DONE", "CANCELLED"].includes(task.status))
    return [];
  const result: NudgeStep[] = [];
  const add = (
    step: string,
    at: Date,
    priority: "normal" | "high" = "normal",
    allAdmins = false,
  ) => {
    const held = wakingAt(at, task.gigAt);
    if (held <= now) result.push({ step, at: held, priority, allAdmins });
  };
  const repeat = (
    prefix: string,
    from: Date,
    interval: number,
    priority: "normal" | "high" = "high",
  ) => {
    if (from > now) return;
    let at = from;
    for (let n = 0; at <= now; n++) {
      if (at > now) break;
      add(`${prefix}-${n}`, at, priority);
      at = addWakingHours(at, interval, task.gigAt);
    }
  };
  const speed = task.critical ? 2 : 1;
  if (task.status === "BLOCKED") {
    if (task.checkBackAt)
      repeat("check-back", task.checkBackAt, 14 / speed, "normal");
  } else if (task.status === "IN_REVIEW") {
    if (task.submittedAt)
      repeat(
        "review",
        new Date(task.submittedAt.getTime() + (24 * HOUR) / speed),
        4 / speed,
        "normal",
      );
  } else {
    const due = task.dueAt.getTime();
    add("t-24h", new Date(due - (24 * HOUR) / speed));
    const today = nzDate(dayKey(task.dueAt), 9);
    if (today.getTime() < due) add("due-today", today);
    add("t-2h", new Date(due - (2 * HOUR) / speed));
    add("due", task.dueAt, "high");
    repeat(
      "overdue",
      addWakingHours(task.dueAt, 4 / speed, task.gigAt),
      4 / speed,
    );
    add(
      "escalated",
      new Date(due + (task.critical ? 6 : 24) * HOUR),
      "high",
      true,
    );
    add("critical", new Date(due + (72 * HOUR) / speed), "high", true);
  }
  // Risk is urgent even while a task is externally blocked. Dependency-waiting risk is handled separately.
  if (task.atRisk) add("at-risk", now, "high", true);
  return result.sort(
    (a, b) =>
      a.at.getTime() - b.at.getTime() ||
      Number(a.allAdmins) - Number(b.allAdmins),
  );
}
