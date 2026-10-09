import { isOpen, type TaskStatus } from "./status";
export type StandingTask = {
  id: string;
  assigneeId: string | null;
  status: TaskStatus;
  plannedDueAt: Date;
  dueAt: Date;
  submittedAt: Date | null;
  completedAt: Date | null;
  waiting?: boolean;
};
export type StandingEvent = {
  taskId: string;
  actorId: string | null;
  kind: string;
  createdAt: Date;
  fromDueAt: Date | null;
  fromUserId: string | null;
  toUserId: string | null;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus | null;
};
export function wasFlagged(
  events: readonly StandingEvent[],
  taskId: string,
  before?: Date,
) {
  return (
    events.some(
      (event) =>
        event.taskId === taskId &&
        ["DELAY_REPORTED", "OFFERED"].includes(event.kind) &&
        (!before || event.createdAt <= before),
    ) ||
    events.some(
      (event) =>
        event.taskId === taskId &&
        event.toStatus === "BLOCKED" &&
        (!before || event.createdAt <= before),
    )
  );
}
/** Historical attribution comes from submission/taking events, rather than today's assignee. */
export function standings(
  people: readonly { id: string; name: string }[],
  tasks: readonly StandingTask[],
  events: readonly StandingEvent[],
  rounds: readonly {
    owedById: string;
    owedToId: string | null;
    settledAt: Date | null;
    waivedAt: Date | null;
  }[],
  now: Date,
) {
  const since = new Date(now.getTime() - 90 * 86400_000);
  return [...people]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((person) => {
      const owned = tasks.filter(
        (task) => task.assigneeId === person.id && isOpen(task.status),
      );
      const completions = events.filter(
        (event) =>
          (event.toUserId ?? event.actorId) === person.id &&
          event.createdAt >= since &&
          (event.toStatus === "IN_REVIEW" ||
            (event.toStatus === "DONE" && event.fromStatus !== "IN_REVIEW")),
      );
      const submitted = new Map(
        completions.map((event) => [event.taskId, event]),
      );
      let onTime = 0,
        lateFlagged = 0,
        silentMisses = 0;
      for (const [id, event] of submitted) {
        const task = tasks.find((task) => task.id === id);
        if (!task) continue;
        if (event.createdAt <= task.plannedDueAt) onTime++;
        else if (wasFlagged(events, id, event.createdAt)) lateFlagged++;
        else silentMisses++;
      }
      // A still-open silent miss belongs in the same facts as a completed one.
      for (const task of owned)
        if (
          !submitted.has(task.id) &&
          task.dueAt >= since &&
          !task.submittedAt &&
          !task.waiting &&
          now.getTime() - task.dueAt.getTime() >= 24 * 3600_000 &&
          !wasFlagged(events, task.id)
        )
          silentMisses++;
      const taken = events.filter(
        (event) =>
          event.kind === "TAKEN" &&
          event.actorId === person.id &&
          event.createdAt >= since &&
          event.fromDueAt &&
          event.createdAt > event.fromDueAt,
      );
      const outstanding = rounds.filter(
        (round) => !round.settledAt && !round.waivedAt,
      );
      return {
        ...person,
        open: owned.length,
        overdue: owned.filter(
          (task) => !task.submittedAt && !task.waiting && task.dueAt < now,
        ).length,
        onTime,
        lateFlagged,
        silentMisses,
        rescues: taken.length,
        earlyDelays: events.filter(
          (event) =>
            event.actorId === person.id &&
            event.kind === "DELAY_REPORTED" &&
            event.createdAt >= since &&
            event.fromDueAt &&
            event.createdAt < event.fromDueAt,
        ).length,
        roundsOwed: outstanding.filter((round) => round.owedById === person.id)
          .length,
        roundsDue: outstanding.filter((round) => round.owedToId === person.id)
          .length,
      };
    });
}
