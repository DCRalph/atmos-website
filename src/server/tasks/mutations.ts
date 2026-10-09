import "server-only";
import { TRPCError } from "@trpc/server";
import type { z } from "zod";
import { Prisma, type TaskSource } from "~Prisma/client";
import { type taskFields } from "~/lib/tasks/input";
import { isOpen, transitionFor, type TaskStatus } from "~/lib/tasks/status";
import { downstreamIds, projectSchedule } from "~/lib/tasks/schedule";
import { wasFlagged } from "~/lib/tasks/standings";
import { formatTaskDate } from "~/lib/tasks/time";
import {
  taskTransaction,
  requireTask,
  requireTaskPerson,
  taskSettings,
  type TaskDatabase,
} from "./data";
import { notifyTasks, type TaskNotice } from "./notifications";
import { logActivity } from "~/server/utils/activity-log";

export async function commitShifts(
  tx: TaskDatabase,
  causeTaskId: string,
  now: Date,
) {
  const tasks = await tx.task.findMany({ include: { dependencies: true } });
  const dependencies = tasks.flatMap((task) => task.dependencies);
  const downstream = downstreamIds(causeTaskId, dependencies);
  const projection = projectSchedule(tasks, dependencies, now);
  const notices: TaskNotice[] = [];
  const userIds: (string | null)[] = [];
  for (const task of tasks.filter(
    (task) => downstream.has(task.id) && isOpen(task.status),
  )) {
    const next = projection.get(task.id)!;
    if (next.projectedDueAt > task.dueAt) {
      await tx.task.update({
        where: { id: task.id },
        data: { dueAt: next.projectedDueAt },
      });
      await tx.taskEvent.create({
        data: {
          taskId: task.id,
          kind: "SHIFTED",
          fromDueAt: task.dueAt,
          toDueAt: next.projectedDueAt,
          causeTaskId,
        },
      });
      notices.push({
        taskId: task.id,
        title: "Task date moved",
        body: `${task.title}: ${formatTaskDate(next.projectedDueAt)}. An upstream task changed.${next.atRisk ? ` Still ${next.shortMinutes} minutes short of its hard deadline.` : ""}`,
        userIds: [task.assigneeId, task.createdById],
        allAdmins: task.critical && next.atRisk,
      });
      userIds.push(task.assigneeId);
    } else if (next.atRisk) {
      notices.push({
        taskId: task.id,
        title: "Task at risk",
        body: `${task.title} needs ${next.shortMinutes} more minutes before its hard deadline.`,
        userIds: [],
        allAdmins: true,
      });
    }
  }
  return { notices, userIds };
}
export async function createTask(
  input: z.output<typeof taskFields>,
  actorId: string,
  source: TaskSource = "MANUAL",
  dependsOnId?: string,
) {
  const task = await taskTransaction(async (tx) => {
    await requireTaskPerson(tx, input.assigneeId);
    await requireTaskPerson(tx, input.reviewerId);
    if (!input.assigneeId)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Choose an admin to own this task",
      });
    const gig = input.gigId
      ? await tx.gig.findUnique({ where: { id: input.gigId } })
      : null;
    if (input.gigId && !gig)
      throw new TRPCError({ code: "NOT_FOUND", message: "Gig not found" });
    const hardDeadlineAt =
      input.hardDeadlineAt === undefined
        ? (gig?.gigStartTime ?? null)
        : input.hardDeadlineAt;
    if (hardDeadlineAt && input.dueAt > hardDeadlineAt)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "The due date cannot be past the hard deadline",
      });
    if (input.automation && !gig)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Automatic completion needs a gig",
      });
    const parent = dependsOnId ? await requireTask(tx, dependsOnId) : null;
    const { automation, ...fields } = input;
    let task = await tx.task.create({
      data: {
        ...fields,
        automation: automation ?? undefined,
        hardDeadlineAt,
        plannedDueAt: input.dueAt,
        createdById: actorId,
        source,
        events: {
          create: { kind: "CREATED", actorId, toUserId: input.assigneeId },
        },
      },
    });
    if (parent) {
      await tx.taskDependency.create({
        data: {
          taskId: task.id,
          dependsOnId: parent.id,
          gapMinutes: Math.max(
            0,
            Math.round(
              (task.plannedDueAt.getTime() - parent.plannedDueAt.getTime()) /
                60_000,
            ),
          ),
        },
      });
      const graph = await tx.task.findMany({ include: { dependencies: true } });
      const projected = projectSchedule(
        graph,
        graph.flatMap((row) => row.dependencies),
        new Date(),
      ).get(task.id)!;
      if (projected.projectedDueAt > task.dueAt) {
        await tx.taskEvent.create({
          data: {
            taskId: task.id,
            kind: "SHIFTED",
            causeTaskId: parent.id,
            fromDueAt: task.dueAt,
            toDueAt: projected.projectedDueAt,
          },
        });
        task = await tx.task.update({
          where: { id: task.id },
          data: { dueAt: projected.projectedDueAt },
        });
      }
    }
    return task;
  });
  await logActivity({
    type: "TASK_CREATED",
    userId: actorId,
    action: `Created task: ${task.title}`,
    details: { taskId: task.id },
  });
  // Creation banners are reserved and batched by the next sweep, never sent here.
  await notifyTasks([], [task.assigneeId]);
  return task;
}
/** Accept a reviewed selection atomically. Each proposal must still be pending. */
export async function acceptTaskProposals(
  inputs: readonly { id: string; assigneeId: string; dueAt: Date }[],
  actorId: string,
) {
  const tasks = await taskTransaction(async (tx) => {
    const rows = [];
    for (const input of inputs) {
      const task = await requireTask(tx, input.id);
      if (task.status !== "PROPOSED")
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only proposals can be accepted",
        });
      await requireTaskPerson(tx, input.assigneeId);
      if (task.hardDeadlineAt && input.dueAt > task.hardDeadlineAt)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The due date crosses the hard deadline",
        });
      await tx.taskEvent.create({
        data: {
          taskId: task.id,
          actorId,
          kind: "ACCEPTED",
          fromStatus: "PROPOSED",
          toStatus: "TODO",
          toUserId: input.assigneeId,
        },
      });
      rows.push(
        await tx.task.update({
          where: { id: task.id },
          data: {
            status: "TODO",
            assigneeId: input.assigneeId,
            dueAt: input.dueAt,
            plannedDueAt: input.dueAt,
          },
        }),
      );
    }
    return rows;
  });
  await logActivity({
    type: "TASK_CREATED",
    userId: actorId,
    action:
      tasks.length === 1
        ? `Accepted task: ${tasks[0]!.title}`
        : `Accepted ${tasks.length} tasks`,
    details: { taskIds: tasks.map((task) => task.id) },
  });
  await notifyTasks(
    [],
    tasks.map((task) => task.assigneeId),
  );
  return tasks;
}
export async function updateTask(
  id: string,
  input: Partial<z.output<typeof taskFields>>,
  actorId: string,
) {
  const result = await taskTransaction(async (tx) => {
    const task = await requireTask(tx, id);
    await requireTaskPerson(tx, input.assigneeId);
    await requireTaskPerson(tx, input.reviewerId);
    if (input.assigneeId === null && task.status !== "PROPOSED")
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Active tasks need an owner",
      });
    if (
      input.reviewerId !== undefined &&
      input.reviewerId !== task.reviewerId &&
      task.status === "IN_REVIEW"
    )
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Send the task back before changing its reviewer",
      });
    const gigId = input.gigId === undefined ? task.gigId : input.gigId;
    const gig = gigId
      ? await tx.gig.findUnique({ where: { id: gigId } })
      : null;
    if (gigId && !gig)
      throw new TRPCError({ code: "NOT_FOUND", message: "Gig not found" });
    const deadline =
      input.hardDeadlineAt === undefined
        ? input.gigId !== undefined
          ? (gig?.gigStartTime ?? null)
          : task.hardDeadlineAt
        : input.hardDeadlineAt;
    const due = input.dueAt ?? task.dueAt;
    if (deadline && due > deadline)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "The due date cannot be past the hard deadline",
      });
    if (
      (input.automation === undefined ? task.automation : input.automation) &&
      !gigId
    )
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Automatic completion needs a gig",
      });
    const { automation, ...fields } = input;
    const updated = await tx.task.update({
      where: { id },
      data: {
        ...fields,
        hardDeadlineAt: deadline,
        ...(automation !== undefined
          ? { automation: automation ?? Prisma.JsonNull }
          : {}),
      },
    });
    const notices: TaskNotice[] = [];
    if (input.assigneeId && input.assigneeId !== task.assigneeId) {
      await tx.taskEvent.create({
        data: {
          taskId: id,
          actorId,
          kind: "ASSIGNED",
          fromUserId: task.assigneeId,
          toUserId: input.assigneeId,
          onBehalf: task.assigneeId !== actorId,
        },
      });
      notices.push({
        taskId: id,
        title: "Task reassigned",
        body: `${task.title} has a new owner.`,
        userIds: [task.assigneeId, input.assigneeId, task.createdById],
      });
    }
    let shifts = {
      notices: [] as TaskNotice[],
      userIds: [] as (string | null)[],
    };
    if (input.dueAt && input.dueAt.getTime() !== task.dueAt.getTime()) {
      await tx.taskEvent.create({
        data: {
          taskId: id,
          actorId,
          kind: "DUE_CHANGED",
          fromDueAt: task.dueAt,
          toDueAt: input.dueAt,
          onBehalf: task.assigneeId !== actorId,
        },
      });
      shifts = await commitShifts(tx, id, new Date());
      notices.push({
        taskId: id,
        title: "Task date changed",
        body: `${task.title}: ${formatTaskDate(input.dueAt)}.`,
        userIds: [task.assigneeId, task.createdById],
      });
    }
    return {
      updated,
      notices: [...notices, ...shifts.notices],
      userIds: [task.assigneeId, updated.assigneeId, ...shifts.userIds],
    };
  });
  await logActivity({
    type: "TASK_UPDATED",
    userId: actorId,
    action: `Updated task: ${result.updated.title}`,
    details: { taskId: id },
  });
  await notifyTasks(result.notices, result.userIds);
  return result.updated;
}
export async function setTaskStatus(
  id: string,
  status: TaskStatus,
  actorId: string | null,
  body?: string,
  checkBackAt?: Date,
  validate?: (
    tx: TaskDatabase,
    task: Awaited<ReturnType<typeof requireTask>>,
  ) => Promise<void>,
) {
  const result = await taskTransaction(async (tx) => {
    const task = await requireTask(tx, id);
    await validate?.(tx, task);
    const rule = transitionFor(task.status, status, !!task.reviewerId);
    if (!rule)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "That status transition is not available",
      });
    if (rule.reason && !body?.trim())
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Explain why before changing this status",
      });
    const now = new Date();
    if (status === "BLOCKED" && (!checkBackAt || checkBackAt <= now))
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Choose a future check-back time",
      });
    if (status === "DONE" || status === "IN_REVIEW") {
      const pending = await tx.taskDependency.count({
        where: { taskId: id, dependsOn: { status: { not: "DONE" } } },
      });
      if (pending)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Finish the dependencies before submitting this task",
        });
      const proof =
        task.proofRequired && task.proofUploadId
          ? await tx.file_upload.findFirst({
              where: {
                id: task.proofUploadId,
                status: "OK",
                for: "task",
                forId: id,
                mimeType: { startsWith: "image/" },
              },
            })
          : null;
      if (task.proofRequired && !proof)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Attach proof before completing this task",
        });
    }
    const target =
      rule.who === "reviewer"
        ? task.reviewerId
        : rule.who === "assignee"
          ? task.assigneeId
          : actorId;
    const submitted =
      status === "IN_REVIEW" ||
      (status === "DONE" && task.status !== "IN_REVIEW");
    const reopened =
      status === "IN_PROGRESS" && ["DONE", "IN_REVIEW"].includes(task.status);
    const updated = await tx.task.update({
      where: { id },
      data: {
        status,
        checkBackAt: status === "BLOCKED" ? checkBackAt : null,
        startedAt:
          status === "IN_PROGRESS" ? (task.startedAt ?? now) : task.startedAt,
        submittedAt: submitted ? now : reopened ? null : task.submittedAt,
        completedAt:
          status === "DONE" ? now : reopened ? null : task.completedAt,
        completedById:
          status === "DONE" ? actorId : reopened ? null : task.completedById,
        upForGrabs: ["DONE", "IN_REVIEW", "CANCELLED"].includes(status)
          ? false
          : task.upForGrabs,
      },
    });
    await tx.taskEvent.create({
      data: {
        taskId: id,
        actorId,
        kind: "STATUS_CHANGED",
        body,
        fromStatus: task.status,
        toStatus: status,
        fromDueAt: task.dueAt,
        toUserId: submitted ? task.assigneeId : null,
        onBehalf: actorId !== null && target !== actorId,
      },
    });
    const shifts =
      status === "DONE"
        ? await commitShifts(tx, id, now)
        : { notices: [], userIds: [] };
    const notice: TaskNotice = {
      taskId: id,
      title: status === "IN_REVIEW" ? "Ready for review" : "Task updated",
      body: `${task.title}: ${status.toLowerCase().replaceAll("_", " ")}${body ? `. ${body}` : ""}.`,
      userIds: [
        task.createdById,
        task.assigneeId,
        status === "IN_REVIEW" ? task.reviewerId : null,
      ],
      allAdmins: task.critical && status === "BLOCKED",
    };
    return {
      updated,
      notices:
        task.status === "PROPOSED"
          ? shifts.notices
          : [notice, ...shifts.notices],
      userIds: [task.assigneeId, task.reviewerId, ...shifts.userIds],
    };
  });
  await logActivity({
    type: "TASK_STATUS_CHANGED",
    userId: actorId ?? undefined,
    action: `${result.updated.title}: ${status}`,
    details: { taskId: id },
  });
  await notifyTasks(result.notices, result.userIds);
  return result.updated;
}
export async function reportTaskDelay(
  id: string,
  dueAt: Date,
  body: string,
  actorId: string,
) {
  const result = await taskTransaction(async (tx) => {
    const task = await requireTask(tx, id);
    if (!isOpen(task.status) || task.status === "IN_REVIEW")
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This task cannot be delayed",
      });
    if (dueAt <= task.dueAt || dueAt <= new Date())
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Choose a later, future due date",
      });
    if (task.hardDeadlineAt && dueAt > task.hardDeadlineAt)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "The new date crosses the hard deadline. Reassign or change the plan instead.",
      });
    const updated = await tx.task.update({ where: { id }, data: { dueAt } });
    await tx.taskEvent.create({
      data: {
        taskId: id,
        actorId,
        kind: "DELAY_REPORTED",
        body,
        fromDueAt: task.dueAt,
        toDueAt: dueAt,
        onBehalf: task.assigneeId !== actorId,
      },
    });
    const shifts = await commitShifts(tx, id, new Date());
    const actor = await tx.user.findUnique({
      where: { id: actorId },
      select: { name: true },
    });
    const reason = `${actor?.name ?? "An admin"}: ${body}`;
    return {
      updated,
      notices: [
        {
          taskId: id,
          title: "Delay reported",
          body: `${task.title}: ${formatTaskDate(dueAt)}. ${reason}`,
          userIds: [task.assigneeId, task.createdById],
          allAdmins: task.critical,
        },
        ...shifts.notices.map((notice) => ({
          ...notice,
          body: `${notice.body} ${reason}`,
        })),
      ],
      userIds: [task.assigneeId, ...shifts.userIds],
    };
  });
  await logActivity({
    type: "TASK_DELAY_REPORTED",
    userId: actorId,
    action: `Delay reported: ${result.updated.title}`,
    details: { taskId: id, body },
  });
  await notifyTasks(result.notices, result.userIds);
  return result.updated;
}
export async function takeTask(id: string, actorId: string) {
  const result = await taskTransaction(async (tx) => {
    const task = await requireTask(tx, id);
    await requireTaskPerson(tx, actorId);
    const owner = task.assignee
      ? await tx.userPermissionAssignment.count({
          where: {
            userId: task.assigneeId!,
            permission: { in: ["ADMIN", "SUPERADMIN"] },
          },
        })
      : 0;
    if (
      !isOpen(task.status) ||
      task.status === "IN_REVIEW" ||
      task.assigneeId === actorId ||
      (!task.upForGrabs && task.dueAt >= new Date() && owner)
    )
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Only offered, overdue or unassigned tasks can be taken",
      });
    if (
      await tx.taskDependency.count({
        where: { taskId: id, dependsOn: { status: { not: "DONE" } } },
      })
    )
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "A waiting task has nothing to rescue yet",
      });
    const now = new Date();
    const updated = await tx.task.update({
      where: { id },
      data: { assigneeId: actorId, upForGrabs: false },
    });
    await tx.taskEvent.create({
      data: {
        taskId: id,
        actorId,
        kind: "TAKEN",
        fromUserId: task.assigneeId,
        toUserId: actorId,
        fromDueAt: task.dueAt,
      },
    });
    const settings = await taskSettings(tx);
    if (
      settings.roundsEnabled &&
      task.assigneeId &&
      task.dueAt < now &&
      !wasFlagged(task.events, id, task.plannedDueAt)
    )
      await tx.taskRound.upsert({
        where: { taskId_reason: { taskId: id, reason: "RESCUED" } },
        create: {
          taskId: id,
          owedById: task.assigneeId,
          owedToId: actorId,
          reason: "RESCUED",
        },
        update: {},
      });
    return { updated, previous: task.assigneeId, creator: task.createdById };
  });
  await logActivity({
    type: "TASK_TAKEN",
    userId: actorId,
    action: `Took task: ${result.updated.title}`,
    details: { taskId: id, fromUserId: result.previous },
  });
  await notifyTasks(
    [
      {
        taskId: id,
        title: "Task taken",
        body: `${result.updated.title} has a new owner.`,
        userIds: [result.previous, result.creator],
      },
    ],
    [result.previous, actorId],
  );
  return result.updated;
}
