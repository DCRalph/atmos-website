import "server-only";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import type { Prisma } from "~Prisma/client";
import { projectSchedule } from "~/lib/tasks/schedule";
import { isOpen } from "~/lib/tasks/status";
import { taskSettingsSchema } from "~/lib/tasks/input";
import { userHasPermission } from "~/server/utils/permissions";

export type TaskDatabase = Prisma.TransactionClient;
const person = {
  select: {
    id: true,
    name: true,
    email: true,
    permissions: { select: { permission: true } },
  },
} as const;
export const TASK_INCLUDE = {
  assignee: person,
  reviewer: person,
  createdBy: person,
  gig: { select: { id: true, title: true, gigStartTime: true } },
  dependencies: true,
  dependents: true,
  events: {
    where: {
      OR: [
        { kind: { in: ["DELAY_REPORTED", "OFFERED", "TAKEN"] } },
        { toStatus: "BLOCKED" },
      ],
    },
    orderBy: { createdAt: "asc" },
  },
} as const satisfies Prisma.TaskInclude;
export async function taskPeople(client: TaskDatabase = db) {
  return client.user.findMany({
    where: {
      permissions: { some: { permission: { in: ["ADMIN", "SUPERADMIN"] } } },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      _count: { select: { deviceTokens: true } },
    },
  });
}
export async function requireTaskPerson(
  client: TaskDatabase,
  id: string | null | undefined,
) {
  if (!id) return;
  const user = await client.user.findUnique({
    where: { id },
    select: { id: true, permissions: { select: { permission: true } } },
  });
  if (!user || !userHasPermission(user, "ADMIN"))
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Task owners and reviewers must be admins",
    });
}
export async function readTasks(client: TaskDatabase = db, now = new Date()) {
  const rows = await client.task.findMany({
    include: TASK_INCLUDE,
    orderBy: { dueAt: "asc" },
  });
  const projected = projectSchedule(
    rows,
    rows.flatMap((task) => task.dependencies),
    now,
  );
  const byId = new Map(rows.map((task) => [task.id, task]));
  return rows.map((task) => {
    const state = projected.get(task.id)!;
    const assignee =
      task.assignee && userHasPermission(task.assignee, "ADMIN")
        ? task.assignee
        : null;
    const reviewer =
      task.reviewer && userHasPermission(task.reviewer, "ADMIN")
        ? task.reviewer
        : null;
    const overdue =
      isOpen(task.status) && !task.submittedAt && task.dueAt < now;
    const flagged = task.events.some(
      (event) =>
        event.kind === "DELAY_REPORTED" ||
        event.kind === "OFFERED" ||
        event.toStatus === "BLOCKED",
    );
    const unassigned =
      isOpen(task.status) &&
      (!assignee || (task.status === "IN_REVIEW" && !reviewer));
    const escalated =
      overdue &&
      !state.waiting &&
      !flagged &&
      now.getTime() - task.dueAt.getTime() >=
        (task.critical ? 6 : 24) * 3600_000;
    return {
      ...task,
      ...state,
      actionableAt: state.waiting
        ? null
        : new Date(
            Math.max(
              task.createdAt.getTime(),
              task.startedAt?.getTime() ?? 0,
              ...task.dependencies.map(
                (dep) => byId.get(dep.dependsOnId)?.completedAt?.getTime() ?? 0,
              ),
            ),
          ),
      assignee,
      storedAssigneeId: task.assigneeId,
      assigneeId: assignee?.id ?? null,
      reviewer,
      storedReviewerId: task.reviewerId,
      reviewerId: reviewer?.id ?? null,
      overdue,
      lateMinutes: overdue
        ? Math.floor((now.getTime() - task.dueAt.getTime()) / 60_000)
        : 0,
      flagged,
      unassigned,
      escalated,
      dueSoon:
        isOpen(task.status) &&
        !task.submittedAt &&
        task.dueAt >= now &&
        task.dueAt.getTime() - now.getTime() <= 86400_000,
      blockedReason:
        task.status === "BLOCKED"
          ? ([...task.events]
              .reverse()
              .find((event) => event.toStatus === "BLOCKED")?.body ?? null)
          : null,
    };
  });
}
export type TaskRow = Awaited<ReturnType<typeof readTasks>>[number];
export function taskAlerts(tasks: readonly TaskRow[]) {
  return tasks
    .filter(
      (task) =>
        isOpen(task.status) &&
        (task.atRisk ||
          task.unassigned ||
          task.escalated ||
          (task.overdue && !task.waiting)),
    )
    .sort(
      (a, b) =>
        alertWeight(b) - alertWeight(a) ||
        a.dueAt.getTime() - b.dueAt.getTime(),
    );
}
function alertWeight(task: TaskRow) {
  return task.atRisk
    ? 5
    : task.unassigned
      ? 4
      : task.escalated
        ? 3
        : task.status === "BLOCKED"
          ? 1
          : 2;
}
export async function taskSettings(client: TaskDatabase = db) {
  const row = await client.keyValueStore.findUnique({
    where: { key: "tasks.settings" },
  });
  try {
    return taskSettingsSchema.parse(row ? JSON.parse(row.value) : {});
  } catch {
    return taskSettingsSchema.parse({});
  }
}
/** All graph-changing writes share a transaction lock, including cron writes and hot-potato races. */
export function taskTransaction<T>(work: (tx: TaskDatabase) => Promise<T>) {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('atmos-task-graph'))`;
      return work(tx);
    },
    { timeout: 20_000 },
  );
}
export async function requireTask(client: TaskDatabase, id: string) {
  const task = await client.task.findUnique({
    where: { id },
    include: TASK_INCLUDE,
  });
  if (!task)
    throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
  return task;
}
