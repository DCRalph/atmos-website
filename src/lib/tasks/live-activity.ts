import { dayKey, addDays, nzDate } from "./time";
import { isOpen, type TaskStatus } from "./status";
export type TaskActivityRow = {
  id: string;
  title: string;
  dueAt: Date;
  createdAt: Date;
  startedAt: Date | null;
  actionableAt?: Date | null;
  status: TaskStatus;
  waiting: boolean;
};
export type TaskActivityPayload = {
  userId: string;
  day: string;
  active: boolean;
  taskId: string | null;
  currentName: string | null;
  currentStartsAt: number | null;
  currentEndsAt: number | null;
  nextName: string | null;
  nextStartsAt: number | null;
  remaining: number;
  expiresAt: number;
};
/** Dates are enough for native timers; no continuous pushes or JavaScript countdowns. */
export function taskDayActivity(
  userId: string,
  tasks: readonly TaskActivityRow[],
  now: Date,
): TaskActivityPayload {
  const day = dayKey(now);
  const today = tasks
    .filter(
      (task) =>
        isOpen(task.status) &&
        task.status !== "IN_REVIEW" &&
        !task.waiting &&
        dayKey(task.dueAt) === day,
    )
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  const first = today[0];
  const active =
    !!first && first.dueAt.getTime() - now.getTime() <= 12 * 3600_000;
  const next = today[1];
  const seconds = (date: Date) => Math.floor(date.getTime() / 1000);
  return {
    userId,
    day,
    active,
    taskId: active ? first.id : null,
    currentName: active ? first.title : null,
    currentStartsAt: active
      ? seconds(first.actionableAt ?? first.startedAt ?? first.createdAt)
      : null,
    currentEndsAt: active ? seconds(first.dueAt) : null,
    nextName: active ? (next?.title ?? null) : null,
    nextStartsAt: active && next ? seconds(next.dueAt) : null,
    remaining: Math.max(0, today.length - 2),
    expiresAt: seconds(nzDate(addDays(day, 1))),
  };
}
