import { isOpen, type TaskStatus } from "./status";
export type ScheduleTask = {
  id: string;
  title: string;
  status: TaskStatus;
  assigneeId: string | null;
  dueAt: Date;
  plannedDueAt: Date;
  hardDeadlineAt: Date | null;
  completedAt: Date | null;
  submittedAt: Date | null;
};
export type Dependency = {
  taskId: string;
  dependsOnId: string;
  gapMinutes: number;
};
export type Projection = {
  taskId: string;
  dueAt: Date;
  projectedDueAt: Date;
  requiredDueAt: Date;
  waiting: boolean;
  atRisk: boolean;
  shortMinutes: number;
  causeTaskId: string | null;
};
/** Topological ordering refuses cycles and dangling references before anything is written. */
export function orderTasks(
  tasks: readonly ScheduleTask[],
  dependencies: readonly Dependency[],
) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const incoming = new Map(tasks.map((task) => [task.id, 0]));
  const children = new Map<string, string[]>();
  for (const dep of dependencies) {
    if (!byId.has(dep.taskId) || !byId.has(dep.dependsOnId))
      throw new Error("A dependency task no longer exists");
    incoming.set(dep.taskId, (incoming.get(dep.taskId) ?? 0) + 1);
    children.set(dep.dependsOnId, [
      ...(children.get(dep.dependsOnId) ?? []),
      dep.taskId,
    ]);
  }
  const queue = tasks
    .filter((task) => incoming.get(task.id) === 0)
    .map((task) => task.id);
  const ordered: ScheduleTask[] = [];
  for (const id of queue) {
    ordered.push(byId.get(id)!);
    for (const child of children.get(id) ?? []) {
      const left = incoming.get(child)! - 1;
      incoming.set(child, left);
      if (left === 0) queue.push(child);
    }
  }
  if (ordered.length !== tasks.length)
    throw new Error("Tasks cannot depend on themselves or form a cycle");
  return ordered;
}
/** Keep the uncapped finish estimate through the chain so a deadline cannot hide downstream risk. */
export function projectSchedule(
  tasks: readonly ScheduleTask[],
  dependencies: readonly Dependency[],
  now: Date,
) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const parents = new Map<string, Dependency[]>();
  for (const dep of dependencies)
    parents.set(dep.taskId, [...(parents.get(dep.taskId) ?? []), dep]);
  const result = new Map<string, Projection>();
  for (const task of orderTasks(tasks, dependencies)) {
    let required = task.dueAt.getTime();
    let causeTaskId: string | null = null;
    let waiting = false;
    for (const dep of parents.get(task.id) ?? []) {
      const parent = byId.get(dep.dependsOnId)!;
      if (parent.status !== "DONE") waiting = true;
      const projected = result.get(parent.id)!;
      const finish =
        parent.status === "DONE" && parent.completedAt
          ? parent.completedAt.getTime()
          : Math.max(projected.requiredDueAt.getTime(), now.getTime());
      const candidate = finish + dep.gapMinutes * 60_000;
      if (candidate > required) {
        required = candidate;
        causeTaskId = parent.id;
      }
    }
    if (!isOpen(task.status)) required = task.dueAt.getTime();
    const deadline = task.hardDeadlineAt?.getTime();
    const atRisk =
      isOpen(task.status) && deadline !== undefined && required > deadline;
    result.set(task.id, {
      taskId: task.id,
      dueAt: task.dueAt,
      projectedDueAt: new Date(atRisk ? deadline : required),
      requiredDueAt: new Date(required),
      waiting: isOpen(task.status) && waiting,
      atRisk,
      shortMinutes: atRisk ? Math.ceil((required - deadline) / 60_000) : 0,
      causeTaskId,
    });
  }
  return result;
}
export function downstreamIds(
  taskId: string,
  dependencies: readonly Dependency[],
) {
  const children = new Map<string, string[]>();
  for (const dep of dependencies)
    children.set(dep.dependsOnId, [
      ...(children.get(dep.dependsOnId) ?? []),
      dep.taskId,
    ]);
  const found = new Set<string>();
  const queue = [taskId];
  for (const id of queue)
    for (const child of children.get(id) ?? [])
      if (!found.has(child)) {
        found.add(child);
        queue.push(child);
      }
  found.delete(taskId);
  return found;
}
export function impact(
  tasks: readonly ScheduleTask[],
  dependencies: readonly Dependency[],
  taskId: string,
  newDueAt: Date,
  now: Date,
) {
  const descendants = downstreamIds(taskId, dependencies);
  const projected = projectSchedule(
    tasks.map((task) =>
      task.id === taskId ? { ...task, dueAt: newDueAt } : task,
    ),
    dependencies,
    now,
  );
  return tasks
    .filter((task) => descendants.has(task.id) && isOpen(task.status))
    .flatMap((task) => {
      const state = projected.get(task.id)!;
      const shiftMinutes = Math.round(
        (state.projectedDueAt.getTime() - task.dueAt.getTime()) / 60_000,
      );
      return shiftMinutes > 0 || state.atRisk
        ? [
            {
              ...state,
              title: task.title,
              assigneeId: task.assigneeId,
              shiftMinutes,
            },
          ]
        : [];
    });
}
