export const TASK_STATUSES = [
  "PROPOSED",
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "IN_REVIEW",
  "DONE",
  "CANCELLED",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const statusLabels: Record<TaskStatus, string> = {
  PROPOSED: "Proposed",
  TODO: "To do",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  IN_REVIEW: "In review",
  DONE: "Done",
  CANCELLED: "Cancelled",
};
type Transition = {
  from: readonly TaskStatus[];
  to: TaskStatus;
  who: "assignee" | "reviewer" | "admin";
  reason?: boolean;
  review?: boolean;
};
/** One table drives validation and both clients' action menus. Admin overrides are explicit in the timeline. */
export const transitions: readonly Transition[] = [
  { from: ["PROPOSED"], to: "TODO", who: "admin" },
  { from: ["TODO", "BLOCKED"], to: "IN_PROGRESS", who: "assignee" },
  {
    from: ["TODO", "IN_PROGRESS", "BLOCKED"],
    to: "BLOCKED",
    who: "assignee",
    reason: true,
  },
  {
    from: ["TODO", "IN_PROGRESS", "BLOCKED"],
    to: "IN_REVIEW",
    who: "assignee",
    review: true,
  },
  {
    from: ["TODO", "IN_PROGRESS", "BLOCKED"],
    to: "DONE",
    who: "assignee",
    review: false,
  },
  { from: ["IN_REVIEW"], to: "DONE", who: "reviewer" },
  { from: ["IN_REVIEW"], to: "IN_PROGRESS", who: "reviewer", reason: true },
  { from: ["DONE"], to: "IN_PROGRESS", who: "admin" },
  {
    from: ["PROPOSED", "TODO", "IN_PROGRESS", "BLOCKED", "IN_REVIEW"],
    to: "CANCELLED",
    who: "admin",
  },
];
export function transitionFor(
  from: TaskStatus,
  to: TaskStatus,
  hasReviewer: boolean,
) {
  return transitions.find(
    (rule) =>
      rule.from.includes(from) &&
      rule.to === to &&
      (rule.review === undefined || rule.review === hasReviewer),
  );
}
export function isOpen(status: TaskStatus) {
  return status !== "DONE" && status !== "CANCELLED" && status !== "PROPOSED";
}
export function statusActions(
  task: {
    status: TaskStatus;
    reviewerId: string | null;
    assigneeId: string | null;
  },
  userId: string,
  onBehalf = false,
) {
  return transitions.filter(
    (rule) =>
      transitionFor(task.status, rule.to, !!task.reviewerId) === rule &&
      (onBehalf ||
        rule.who === "admin" ||
        (rule.who === "assignee"
          ? task.assigneeId === userId
          : task.reviewerId === userId)),
  );
}
