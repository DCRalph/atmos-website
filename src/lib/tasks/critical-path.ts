import { orderTasks, type ScheduleTask, type Dependency } from "./schedule";
/** Count owners on the longest dependency path, rather than calling every open task the critical path. */
export function criticalPathOwners(
  tasks: readonly ScheduleTask[],
  dependencies: readonly Dependency[],
) {
  const paths = new Map<string, string[]>();
  const byId = new Map(tasks.map((task) => [task.id, task]));
  for (const task of orderTasks(tasks, dependencies)) {
    const parents = dependencies
      .filter((dep) => dep.taskId === task.id)
      .map((dep) => paths.get(dep.dependsOnId) ?? [])
      .sort((a, b) => b.length - a.length);
    paths.set(task.id, [...(parents[0] ?? []), task.id]);
  }
  const path = [...paths.values()].sort((a, b) => b.length - a.length)[0] ?? [];
  const owners = new Map<string, number>();
  for (const id of path) {
    const owner = byId.get(id)?.assigneeId;
    if (owner) owners.set(owner, (owners.get(owner) ?? 0) + 1);
  }
  return [...owners]
    .filter(([, count]) => path.length > 1 && count > path.length / 2)
    .map(([userId, count]) => ({ userId, count, total: path.length }));
}
