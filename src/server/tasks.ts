import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "~/server/db";
import {
  readTasks,
  taskPeople,
  taskSettings,
  taskTransaction,
  type TaskRow,
} from "./tasks/data";
import { notifyTasks } from "./tasks/notifications";
import { setTaskStatus } from "./tasks/mutations";
import { sendPush, countAudience, type Audience } from "./push";
import { publish } from "./notify";
import { nudgeSteps, wakingAt, type NudgeStep } from "~/lib/tasks/nudges";
import { wasFlagged } from "~/lib/tasks/standings";
import { isOpen } from "~/lib/tasks/status";
import { downstreamIds } from "~/lib/tasks/schedule";
import { dayKey, nzParts, formatTaskDate } from "~/lib/tasks/time";
import { automationSchema } from "~/lib/tasks/input";
import { taskAI, adviceSchema } from "./tasks/extract";
import { TRPCError } from "@trpc/server";
import { taskPushBody } from "~/lib/tasks/push-copy";

function reminderCopy(
  task: TaskRow,
  step: string,
  nagVoice = false,
  roundsEnabled = false,
) {
  if (step.startsWith("review"))
    return {
      title: "Ready for your review",
      body: `${task.title} was submitted ${task.submittedAt ? formatTaskDate(task.submittedAt) : "earlier"}. Accept it or send it back with a comment.`,
    };
  if (step.startsWith("check-back"))
    return {
      title: "Still blocked?",
      body: `${task.title}: ${task.blockedReason ?? "check what is holding it up"}. Update the reason and check-back date, or restart it.`,
    };
  if (step === "at-risk")
    return {
      title: "Task deadline at risk",
      body: `${task.title} needs ${task.shortMinutes} more minutes before its hard deadline.`,
    };
  if (task.overdue)
    return {
      title:
        step === "critical"
          ? "Task still overdue"
          : step === "escalated"
            ? "Task escalated"
            : "Task overdue",
      body: `${task.title} was due ${formatTaskDate(task.dueAt)}.${task.flagged ? " The delay was flagged." : " No delay has been reported."}${roundsEnabled && !task.flagged && Date.now() - task.dueAt.getTime() >= 24 * 3600_000 ? " That's a round." : ""}${nagVoice && step.startsWith("overdue") ? (Number(step.slice("overdue-".length)) >= 4 ? " This one's getting older than some of our openers." : " This one's still waiting for you.") : ""} Finish it, report a delay, or pass it on.`,
    };
  return {
    title:
      task.status === "IN_PROGRESS"
        ? "How is it going?"
        : step === "due-today"
          ? "Due today"
          : "Task reminder",
    body: `${task.title} is due ${formatTaskDate(task.dueAt)}.${task.status === "IN_PROGRESS" ? " Flag it early if you need more time." : ""}`,
  };
}
async function deliverNudge(
  task: TaskRow,
  step: NudgeStep,
  nudgeId: string,
  nagVoice: boolean,
  actorId?: string,
  roundsEnabled = false,
) {
  const people = await taskPeople();
  const target =
    task.status === "IN_REVIEW" ? task.reviewerId : task.assigneeId;
  const userIds = step.allAdmins
    ? people.map((person) => person.id)
    : people
        .filter((person) => person.id === target)
        .map((person) => person.id);
  const audience: Audience = { kind: "users", userIds };
  const fullCopy = reminderCopy(task, step.step, nagVoice, roundsEnabled);
  const copy = { ...fullCopy, body: taskPushBody(fullCopy.body) };
  let devices = 0,
    delivered = 0;
  if (step.allAdmins) {
    const result = await publish(
      {
        topic: "tasks",
        title: copy.title,
        message: copy.body,
        priority: 5,
        tags: ["tasks"],
        click: `/tasks/${task.id}`,
      },
      { source: "tasks", audience, categoryId: "TASK_ACTIONS" },
    );
    devices = result.delivery.devices;
    delivered = result.delivery.delivered;
  } else {
    devices = await countAudience(audience);
    const result = await sendPush({
      audience,
      ...copy,
      data: { url: `/tasks/${task.id}`, taskId: task.id },
      priority: step.priority,
      categoryId: "TASK_ACTIONS",
    });
    delivered = result.sent;
  }
  await db.taskNudge.update({
    where: { id: nudgeId },
    data: { devices, delivered },
  });
  await db.taskEvent.create({
    data: {
      taskId: task.id,
      actorId,
      kind: step.allAdmins ? "ESCALATED" : "NUDGED",
      body: copy.body,
    },
  });
  await notifyTasks([], [task.assigneeId]);
  return { devices, delivered };
}
/** Reserve the latest step and skip older elapsed steps in the same transaction. */
async function reserveNudge(task: TaskRow, steps: readonly NudgeStep[]) {
  const latest = steps.at(-1);
  if (!latest) return null;
  const forDueAt =
    task.status === "IN_REVIEW"
      ? task.submittedAt!
      : task.status === "BLOCKED"
        ? task.checkBackAt!
        : task.dueAt;
  return taskTransaction(async (tx) => {
    const current = await tx.task.findUnique({ where: { id: task.id } });
    if (
      current?.status !== task.status ||
      current.dueAt.getTime() !== task.dueAt.getTime() ||
      current.assigneeId !== task.storedAssigneeId ||
      current.reviewerId !== task.storedReviewerId ||
      current.submittedAt?.getTime() !== task.submittedAt?.getTime() ||
      current.checkBackAt?.getTime() !== task.checkBackAt?.getTime()
    )
      return null;
    // Risk is sent once, then the ordinary ladder keeps following up.
    let selected = latest;
    if (latest.step === "at-risk") {
      const prior = await tx.taskNudge.findUnique({
        where: {
          taskId_step_forDueAt: { taskId: task.id, step: "at-risk", forDueAt },
        },
      });
      if (prior) {
        const normal = steps.filter((step) => step.step !== "at-risk").at(-1);
        if (!normal) return null;
        selected = normal;
      }
    }
    const escalation = steps
      .filter((step) => step.allAdmins && step.step !== "at-risk")
      .at(-1);
    if (escalation && selected.step !== "at-risk") {
      const prior = await tx.taskNudge.findUnique({
        where: {
          taskId_step_forDueAt: {
            taskId: task.id,
            step: escalation.step,
            forDueAt,
          },
        },
      });
      if (!prior) selected = { ...selected, allAdmins: true };
    }
    const id = randomUUID();
    const reserved = await tx.taskNudge.createMany({
      data: { id, taskId: task.id, step: selected.step, forDueAt },
      skipDuplicates: true,
    });
    if (!reserved.count) return null;
    await tx.taskNudge.createMany({
      data: steps
        .filter((step) => step.step !== selected.step)
        .map((step) => ({
          taskId: task.id,
          step: step.step,
          forDueAt,
          skipped: true,
        })),
      skipDuplicates: true,
    });
    return { id, step: selected };
  });
}
export async function sendTaskNudge(id: string, actorId: string) {
  const task = (await readTasks()).find((task) => task.id === id);
  if (!task || !isOpen(task.status) || task.waiting || task.unassigned)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Only actionable, assigned tasks can be nudged",
    });
  const step = {
    step: `manual-${randomUUID()}`,
    at: new Date(),
    priority: "high" as const,
    allAdmins: false,
  };
  const row = await db.taskNudge.create({
    data: { taskId: id, step: step.step, forDueAt: task.dueAt },
  });
  const settings = await taskSettings();
  return deliverNudge(
    task,
    step,
    row.id,
    settings.nagVoice,
    actorId,
    settings.roundsEnabled,
  );
}
async function batchCreations(tasks: readonly TaskRow[], now: Date) {
  const groups = new Map<string, TaskRow[]>();
  for (const task of tasks) {
    if (!isOpen(task.status) || !task.assigneeId) continue;
    if (wakingAt(now, task.gig?.gigStartTime) > now) continue;
    const claimed = await taskTransaction(async (tx) => {
      const current = await tx.task.findUnique({ where: { id: task.id } });
      if (
        !current ||
        !isOpen(current.status) ||
        current.assigneeId !== task.assigneeId
      )
        return false;
      return (
        (
          await tx.taskNudge.createMany({
            data: {
              taskId: task.id,
              step: "created",
              forDueAt: task.createdAt,
            },
            skipDuplicates: true,
          })
        ).count > 0
      );
    });
    if (claimed)
      groups.set(task.assigneeId, [
        ...(groups.get(task.assigneeId) ?? []),
        task,
      ]);
  }
  for (const [userId, rows] of groups) {
    const first = rows[0]!;
    const audience: Audience = { kind: "users", userIds: [userId] };
    const devices = await countAudience(audience);
    const { sent } = await sendPush({
      audience,
      title: `${rows.length} new task${rows.length === 1 ? "" : "s"}`,
      body: `${rows.length === 1 ? first.title : `${rows.length} tasks`}${rows.every((row) => row.createdById === first.createdById) && first.createdBy ? ` from ${first.createdBy.name}` : ""}. First due ${formatTaskDate(first.dueAt)}.`,
      data: { url: rows.length === 1 ? `/tasks/${first.id}` : "/tasks" },
    });
    await db.taskNudge.updateMany({
      where: { taskId: { in: rows.map((row) => row.id) }, step: "created" },
      data: { devices, delivered: sent },
    });
  }
  return groups.size;
}
async function claimBatch(key: string) {
  return (
    (await db.taskBatchFire.createMany({ data: { key }, skipDuplicates: true }))
      .count > 0
  );
}
async function mondayBrief(tasks: readonly TaskRow[], now: Date) {
  const local = new Date(`${dayKey(now)}T12:00:00Z`);
  if (
    local.getUTCDay() !== 1 ||
    nzParts(now).hour < 9 ||
    nzParts(now).hour >= 22
  )
    return;
  const people = await taskPeople();
  for (const person of people) {
    const mine = tasks.filter(
      (task) =>
        isOpen(task.status) &&
        (task.assigneeId === person.id ||
          (task.status === "IN_REVIEW" && task.reviewerId === person.id)) &&
        task.dueAt.getTime() < now.getTime() + 7 * 86400_000,
    );
    if (
      !mine.length ||
      !(await claimBatch(`monday:${dayKey(now)}:${person.id}`))
    )
      continue;
    let body = `${mine.length} tasks this week. ${mine.filter((task) => task.waiting).length} waiting, ${mine.filter((task) => task.overdue).length} overdue. First: ${mine[0]!.title}.`;
    const mineIds = new Set(mine.map((task) => task.id));
    const waitingOnMe = tasks.filter(
      (task) =>
        isOpen(task.status) &&
        task.dependencies.some((edge) => mineIds.has(edge.dependsOnId)),
    );
    body += ` ${waitingOnMe.length} tasks depend on yours.`;
    const parents = tasks.filter((task) =>
      mine.some((row) =>
        row.dependencies.some((edge) => edge.dependsOnId === task.id),
      ),
    );
    try {
      const advice = await taskAI(
        adviceSchema,
        "monday_brief",
        `Write a concise weekly brief for ${person.name} from these task facts. Mine: ${JSON.stringify(mine)}. Waiting on: ${JSON.stringify(parents)}. Who waits on me: ${JSON.stringify(waitingOnMe)}.`,
        [],
        15_000,
      );
      body = taskPushBody(advice.summary);
    } catch {
      /* A deterministic brief still works without AI. */
    }
    await sendPush({
      audience: { kind: "users", userIds: [person.id] },
      title: "Your Atmos week",
      body,
      data: { url: "/tasks" },
    });
  }
}
async function contingencyAlerts(tasks: readonly TaskRow[], now: Date) {
  const gigs = new Map(
    tasks.flatMap((task) =>
      task.gig ? [[task.gig.id, task.gig] as const] : [],
    ),
  );
  for (const [gigId, gig] of gigs) {
    if (
      gig.gigStartTime <= now ||
      gig.gigStartTime.getTime() - now.getTime() > 48 * 3600_000 ||
      wakingAt(now, gig.gigStartTime) > now
    )
      continue;
    const outstanding = tasks.filter(
      (task) => task.gigId === gigId && task.critical && isOpen(task.status),
    );
    if (
      !outstanding.length ||
      !(await claimBatch(
        `contingency:${gigId}:${gig.gigStartTime.toISOString()}`,
      ))
    )
      continue;
    let body = outstanding
      .map((task) => `${task.title} (${task.assignee?.name ?? "unassigned"})`)
      .join("; ");
    try {
      const advice = await taskAI(
        adviceSchema,
        "gig_contingency",
        `Gig ${gig.title} starts ${gig.gigStartTime.toISOString()}. Suggest a short practical contingency for each unfinished critical task. ${JSON.stringify(outstanding)}`,
        [],
        15_000,
      );
      body += `. ${advice.summary}`;
    } catch {
      /* The unfinished list remains useful without a model. */
    }
    const people = await taskPeople();
    await publish(
      {
        topic: "tasks",
        title: `Critical tasks: ${gig.title}`,
        message: taskPushBody(body),
        priority: 5,
        tags: ["tasks"],
        click: "/tasks",
      },
      {
        source: "tasks",
        audience: { kind: "users", userIds: people.map((person) => person.id) },
      },
    );
  }
}
async function completeAutomations(tasks: readonly TaskRow[]) {
  for (const task of tasks) {
    if (
      !["TODO", "IN_PROGRESS", "BLOCKED"].includes(task.status) ||
      task.waiting ||
      !task.gigId ||
      (task.proofRequired && !task.proofUploadId)
    )
      continue;
    const binding = automationSchema.safeParse(task.automation);
    if (!binding.success) continue;
    let done = false;
    if (binding.data.kind === "POSTER") {
      const gig = await db.gig.findUnique({
        where: { id: task.gigId },
        select: { posterFileUploadId: true },
      });
      done = !!gig?.posterFileUploadId;
    } else if (binding.data.kind === "TICKETS_PUBLISHED")
      done =
        (await db.ticketEvent.count({
          where: { gigId: task.gigId, status: "PUBLISHED" },
        })) > 0;
    else {
      const sales = await db.ticketTier.aggregate({
        where: { event: { gigId: task.gigId } },
        _sum: { soldCount: true },
      });
      done = (sales._sum.soldCount ?? 0) >= binding.data.count;
    }
    if (done) {
      try {
        await setTaskStatus(
          task.id,
          task.reviewerId ? "IN_REVIEW" : "DONE",
          null,
          `Automatically satisfied: ${binding.data.kind.toLowerCase().replaceAll("_", " ")}`,
          undefined,
          async (tx, current) => {
            if (
              current.gigId !== task.gigId ||
              current.reviewerId !== task.reviewerId ||
              JSON.stringify(current.automation) !==
                JSON.stringify(task.automation)
            )
              throw new TRPCError({ code: "CONFLICT" });
            const satisfied =
              binding.data.kind === "POSTER"
                ? !!(
                    await tx.gig.findUnique({
                      where: { id: task.gigId! },
                      select: { posterFileUploadId: true },
                    })
                  )?.posterFileUploadId
                : binding.data.kind === "TICKETS_PUBLISHED"
                  ? (await tx.ticketEvent.count({
                      where: { gigId: task.gigId, status: "PUBLISHED" },
                    })) > 0
                  : ((
                      await tx.ticketTier.aggregate({
                        where: { event: { gigId: task.gigId } },
                        _sum: { soldCount: true },
                      })
                    )._sum.soldCount ?? 0) >= binding.data.count;
            if (!satisfied) throw new TRPCError({ code: "CONFLICT" });
          },
        );
      } catch (error) {
        if (
          !(error instanceof TRPCError) ||
          !["CONFLICT", "BAD_REQUEST"].includes(error.code)
        )
          throw error;
      }
    }
  }
}
/** Time-based work only. Mutations send their own updates; reservations tolerate overlapping five-minute ticks. */
export async function sweepTasks(now = new Date()) {
  await taskTransaction(async (tx) => {
    const expired = await tx.task.findMany({
      where: {
        status: "PROPOSED",
        createdAt: { lt: new Date(now.getTime() - 7 * 86400_000) },
      },
      select: { id: true },
    });
    if (expired.length) {
      await tx.task.updateMany({
        where: {
          id: { in: expired.map((task) => task.id) },
          status: "PROPOSED",
        },
        data: { status: "CANCELLED" },
      });
      await tx.taskEvent.createMany({
        data: expired.map((task) => ({
          taskId: task.id,
          kind: "STATUS_CHANGED",
          fromStatus: "PROPOSED",
          toStatus: "CANCELLED",
          body: "Proposal expired after seven days",
        })),
      });
    }
  });
  let tasks = await readTasks(db, now);
  await completeAutomations(tasks);
  tasks = await readTasks(db, now);
  const settings = await taskSettings();
  const createdBatches = await batchCreations(tasks, now);
  let reminders = 0;
  const dependencies = tasks.flatMap((task) => task.dependencies);
  for (const task of tasks) {
    if (!isOpen(task.status)) continue;
    const steps = task.unassigned
      ? []
      : nudgeSteps({ ...task, gigAt: task.gig?.gigStartTime }, now);
    if (
      (task.waiting || task.unassigned) &&
      task.atRisk &&
      wakingAt(now, task.gig?.gigStartTime) <= now
    )
      steps.push({
        step: "at-risk",
        at: now,
        priority: "high",
        allAdmins: true,
      });
    const reservation = await reserveNudge(task, steps);
    if (reservation) {
      await deliverNudge(
        task,
        reservation.step,
        reservation.id,
        settings.nagVoice,
        undefined,
        settings.roundsEnabled,
      );
      reminders++;
    }
    if (task.overdue && !task.waiting) {
      const descendants = tasks.filter(
        (child) =>
          downstreamIds(task.id, dependencies).has(child.id) &&
          isOpen(child.status),
      );
      if (descendants.length && wakingAt(now, task.gig?.gigStartTime) <= now) {
        const reserved = await reserveNudge(task, [
          {
            step: "dependency-late",
            at: now,
            priority: "normal",
            allAdmins: false,
          },
        ]);
        if (reserved)
          await notifyTasks(
            descendants.map((child) => ({
              taskId: child.id,
              title: "A dependency is late",
              body: `${task.title} is late. '${child.title}' will move with it.`,
              userIds: [child.assigneeId],
            })),
            descendants.map((child) => child.assigneeId),
          );
      }
      if (
        settings.roundsEnabled &&
        task.assigneeId &&
        now.getTime() - task.dueAt.getTime() >= 24 * 3600_000 &&
        !wasFlagged(task.events, task.id)
      )
        await taskTransaction(async (tx) => {
          const current = await tx.task.findUnique({
            where: { id: task.id },
            include: { events: true },
          });
          if (
            !current ||
            current.submittedAt ||
            !isOpen(current.status) ||
            current.assigneeId !== task.assigneeId ||
            current.dueAt.getTime() !== task.dueAt.getTime() ||
            wasFlagged(current.events, current.id)
          )
            return;
          await tx.taskRound.upsert({
            where: {
              taskId_reason: { taskId: task.id, reason: "SILENT_MISS" },
            },
            create: {
              taskId: task.id,
              owedById: task.assigneeId!,
              reason: "SILENT_MISS",
            },
            update: {},
          });
        });
    }
  }
  await mondayBrief(tasks, now);
  await contingencyAlerts(tasks, now);
  await db.taskBatchFire.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - 100 * 86400_000) } },
  });
  return { tasks: tasks.length, createdBatches, reminders };
}
