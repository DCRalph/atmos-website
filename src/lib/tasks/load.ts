import { isOpen, type TaskStatus } from "./status";
export type LoadTask = {
  id: string;
  assigneeId: string | null;
  status: TaskStatus;
  dueAt: Date;
  critical: boolean;
  waiting: boolean;
};
export function taskLoad(
  tasks: readonly LoadTask[],
  userId: string,
  from: Date,
  to: Date,
) {
  const matching = tasks.filter(
    (task) =>
      task.assigneeId === userId &&
      isOpen(task.status) &&
      task.dueAt >= from &&
      task.dueAt < to,
  );
  return {
    count: matching.length,
    weighted: matching.reduce(
      (sum, task) => sum + (task.critical ? 2 : 1) * (task.waiting ? 0.5 : 1),
      0,
    ),
    taskIds: matching.map((task) => task.id),
  };
}
