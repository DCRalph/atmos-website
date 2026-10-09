import { z } from "zod";
import { randomBytes, randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import {
  readTasks,
  taskAlerts,
  taskPeople,
  taskSettings,
  taskTransaction,
  requireTask,
  requireTaskPerson,
} from "~/server/tasks/data";
import {
  createTask,
  acceptTaskProposals,
  updateTask,
  setTaskStatus,
  reportTaskDelay,
  takeTask,
  commitShifts,
} from "~/server/tasks/mutations";
import { notifyTasks } from "~/server/tasks/notifications";
import {
  taskFields,
  taskStatusSchema,
  playbookSchema,
  taskSettingsSchema,
} from "~/lib/tasks/input";
import { impact, orderTasks } from "~/lib/tasks/schedule";
import { taskLoad } from "~/lib/tasks/load";
import { standings } from "~/lib/tasks/standings";
import { taskDayActivity } from "~/lib/tasks/live-activity";
import {
  dayKey,
  startOfWeek,
  nzDate,
  addDays,
  formatTaskDate,
} from "~/lib/tasks/time";
import { isOpen } from "~/lib/tasks/status";
import { extractTasks, taskAI, adviceSchema } from "~/server/tasks/extract";
import { logActivity } from "~/server/utils/activity-log";
import { sendTaskNudge } from "~/server/tasks";
const idInput = z.object({ id: z.string().min(1) });
const reason = z.string().trim().min(1).max(4000);
const personFields = { id: true, name: true } as const;
export const tasksRouter = createTRPCRouter({
  access: adminProcedure.query(({ ctx }) => ({ userId: ctx.session.user.id })),
  list: adminProcedure
    .input(
      z
        .object({
          assigneeId: z.string().optional(),
          gigId: z.string().optional(),
          status: taskStatusSchema.optional(),
          includeClosed: z.boolean().default(false),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const tasks = await readTasks();
      return tasks.filter(
        (task) =>
          ((input?.includeClosed ?? false) ||
            !["DONE", "CANCELLED"].includes(task.status)) &&
          (!input?.assigneeId || task.assigneeId === input.assigneeId) &&
          (!input?.gigId || task.gigId === input.gigId) &&
          (!input?.status || task.status === input.status),
      );
    }),
  alerts: adminProcedure.query(async () => taskAlerts(await readTasks())),
  alertCount: adminProcedure.query(async () => {
    const tasks = await readTasks();
    return {
      count: taskAlerts(tasks).length,
      overdue: tasks.filter((task) => task.overdue && !task.waiting).length,
    };
  }),
  get: adminProcedure.input(idInput).query(async ({ ctx, input }) => {
    const task = (await readTasks()).find((task) => task.id === input.id);
    if (!task)
      throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
    const [timeline, proof] = await Promise.all([
      ctx.db.taskEvent.findMany({
        where: { taskId: input.id },
        include: { actor: { select: personFields } },
        orderBy: { createdAt: "desc" },
        take: 250,
      }),
      task.proofUploadId
        ? ctx.db.file_upload.findUnique({
            where: { id: task.proofUploadId },
            select: { id: true, url: true, name: true },
          })
        : null,
    ]);
    const linked = await ctx.db.task.findMany({
      where: {
        id: {
          in: [
            ...task.dependencies.map((dep) => dep.dependsOnId),
            ...task.dependents.map((dep) => dep.taskId),
          ],
        },
      },
      select: {
        id: true,
        title: true,
        status: true,
        dueAt: true,
        assignee: { select: personFields },
      },
    });
    return { ...task, timeline, linked, proof };
  }),
  options: adminProcedure.query(async ({ ctx }) => {
    const [people, gigs, tasks, playbooks, settings] = await Promise.all([
      taskPeople(),
      ctx.db.gig.findMany({
        where: { gigStartTime: { gte: new Date(Date.now() - 7 * 86400_000) } },
        select: { id: true, title: true, gigStartTime: true },
        orderBy: { gigStartTime: "asc" },
        take: 100,
      }),
      readTasks(),
      ctx.db.taskPlaybook.findMany({ orderBy: { name: "asc" } }),
      taskSettings(),
    ]);
    const from = nzDate(startOfWeek(dayKey(new Date())));
    const to = nzDate(addDays(dayKey(from), 7));
    return {
      userId: ctx.session.user.id,
      people: people.map((person) => ({
        ...person,
        load: taskLoad(
          tasks.map((task) => ({ ...task, dueAt: task.projectedDueAt })),
          person.id,
          from,
          to,
        ),
      })),
      gigs,
      playbooks: playbooks.map((book) => ({
        ...book,
        items: playbookSchema.parse(book.items),
      })),
      settings,
    };
  }),
  create: adminProcedure
    .input(
      taskFields.extend({
        source: z.enum(["MANUAL", "WILL_GPT"]).default("MANUAL"),
        dependsOnId: z.string().min(1).optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { source, dependsOnId, ...fields } = input;
      return createTask(fields, ctx.session.user.id, source, dependsOnId);
    }),
  update: adminProcedure
    .input(
      taskFields.partial().extend({
        id: z.string().min(1),
        // Zod 4 applies inner defaults even inside optional fields. Partial edits must preserve flags.
        critical: z.boolean().optional(),
        proofRequired: z.boolean().optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { id, ...fields } = input;
      return updateTask(id, fields, ctx.session.user.id);
    }),
  assign: adminProcedure
    .input(idInput.extend({ assigneeId: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      updateTask(
        input.id,
        { assigneeId: input.assigneeId },
        ctx.session.user.id,
      ),
    ),
  setStatus: adminProcedure
    .input(
      idInput.extend({
        status: taskStatusSchema,
        body: reason.optional(),
        checkBackAt: z.date().optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      setTaskStatus(
        input.id,
        input.status,
        ctx.session.user.id,
        input.body,
        input.checkBackAt,
      ),
    ),
  reportDelay: adminProcedure
    .input(idInput.extend({ dueAt: z.date(), body: reason }))
    .mutation(({ ctx, input }) =>
      reportTaskDelay(input.id, input.dueAt, input.body, ctx.session.user.id),
    ),
  comment: adminProcedure
    .input(idInput.extend({ body: reason }))
    .mutation(async ({ ctx, input }) => {
      const task = await requireTask(ctx.db, input.id);
      return ctx.db.taskEvent.create({
        data: {
          taskId: task.id,
          actorId: ctx.session.user.id,
          kind: "COMMENT",
          body: input.body,
        },
      });
    }),
  delete: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const task = await taskTransaction(async (tx) => {
      const task = await requireTask(tx, input.id);
      await tx.task.delete({ where: { id: input.id } });
      return task;
    });
    await logActivity({
      type: "TASK_DELETED",
      userId: ctx.session.user.id,
      action: `Deleted task: ${task.title}`,
      details: {
        taskId: task.id,
        assigneeId: task.assigneeId,
        onBehalf: task.createdById !== ctx.session.user.id,
      },
    });
    await notifyTasks([], [task.assigneeId]);
    return { deleted: true };
  }),
  impact: adminProcedure
    .input(idInput.extend({ dueAt: z.date() }))
    .query(async ({ ctx, input }) => {
      const tasks = await ctx.db.task.findMany({
        include: { dependencies: true },
      });
      if (!tasks.some((task) => task.id === input.id))
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      return impact(
        tasks,
        tasks.flatMap((task) => task.dependencies),
        input.id,
        input.dueAt,
        new Date(),
      );
    }),
  addDependency: adminProcedure
    .input(
      idInput.extend({
        dependsOnId: z.string().min(1),
        gapMinutes: z.number().int().min(0).max(525600).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await taskTransaction(async (tx) => {
        const task = await requireTask(tx, input.id);
        const parent = await requireTask(tx, input.dependsOnId);
        if (!isOpen(task.status) && task.status !== "PROPOSED")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Dependencies belong on open tasks",
          });
        const dep = {
          taskId: task.id,
          dependsOnId: parent.id,
          gapMinutes:
            input.gapMinutes ??
            Math.max(
              0,
              Math.round(
                (task.plannedDueAt.getTime() - parent.plannedDueAt.getTime()) /
                  60_000,
              ),
            ),
        };
        const tasks = await tx.task.findMany({
          include: { dependencies: true },
        });
        const existing = tasks
          .flatMap((task) => task.dependencies)
          .filter(
            (edge) =>
              !(
                edge.taskId === dep.taskId &&
                edge.dependsOnId === dep.dependsOnId
              ),
          );
        try {
          orderTasks(tasks, [...existing, dep]);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              error instanceof Error ? error.message : "Invalid dependency",
          });
        }
        await tx.taskDependency.upsert({
          where: {
            taskId_dependsOnId: { taskId: task.id, dependsOnId: parent.id },
          },
          create: dep,
          update: { gapMinutes: dep.gapMinutes },
        });
        await tx.taskEvent.create({
          data: {
            taskId: task.id,
            actorId: ctx.session.user.id,
            kind: "COMMENT",
            body: `Dependency added: ${parent.title} (${dep.gapMinutes} minutes)`,
          },
        });
        return commitShifts(tx, parent.id, new Date());
      });
      await notifyTasks(result.notices, result.userIds);
      return { saved: true };
    }),
  removeDependency: adminProcedure
    .input(idInput.extend({ dependsOnId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await taskTransaction(async (tx) => {
        await requireTask(tx, input.id);
        await tx.taskDependency.deleteMany({
          where: { taskId: input.id, dependsOnId: input.dependsOnId },
        });
        await tx.taskEvent.create({
          data: {
            taskId: input.id,
            actorId: ctx.session.user.id,
            kind: "COMMENT",
            body: `Dependency removed: ${input.dependsOnId}`,
          },
        });
      });
      const task = await requireTask(ctx.db, input.id);
      await notifyTasks([], [task.assigneeId]);
      return { removed: true };
    }),
  offer: adminProcedure
    .input(idInput.extend({ body: z.string().trim().max(4000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const task = await taskTransaction(async (tx) => {
        const task = await requireTask(tx, input.id);
        if (
          !isOpen(task.status) ||
          task.status === "IN_REVIEW" ||
          task.upForGrabs
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This task cannot be offered",
          });
        await tx.taskEvent.create({
          data: {
            taskId: task.id,
            actorId: ctx.session.user.id,
            kind: "OFFERED",
            body: input.body,
            fromDueAt: task.dueAt,
            onBehalf: task.assigneeId !== ctx.session.user.id,
          },
        });
        return tx.task.update({
          where: { id: task.id },
          data: { upForGrabs: true },
        });
      });
      await notifyTasks([
        {
          taskId: task.id,
          title: "Task up for grabs",
          body: `${task.title}, due ${formatTaskDate(task.dueAt)}.${input.body ? ` ${input.body}` : ""} The current owner stays responsible until someone takes it.`,
          userIds: [],
          allAdmins: true,
        },
      ]);
      return task;
    }),
  take: adminProcedure
    .input(idInput)
    .mutation(({ ctx, input }) => takeTask(input.id, ctx.session.user.id)),
  nudge: adminProcedure
    .input(idInput)
    .mutation(({ ctx, input }) => sendTaskNudge(input.id, ctx.session.user.id)),
  accept: adminProcedure
    .input(idInput.extend({ assigneeId: z.string().min(1), dueAt: z.date() }))
    .mutation(
      async ({ ctx, input }) =>
        (await acceptTaskProposals([input], ctx.session.user.id))[0]!,
    ),
  acceptMany: adminProcedure
    .input(
      z.object({
        proposals: z
          .array(
            idInput.extend({ assigneeId: z.string().min(1), dueAt: z.date() }),
          )
          .min(1)
          .max(100),
      }),
    )
    .mutation(({ ctx, input }) =>
      acceptTaskProposals(input.proposals, ctx.session.user.id),
    ),
  dismiss: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    return setTaskStatus(
      input.id,
      "CANCELLED",
      ctx.session.user.id,
      "Proposal dismissed",
      undefined,
      async (_tx, task) => {
        if (task.status !== "PROPOSED")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only proposals can be dismissed",
          });
      },
    );
  }),
  standings: adminProcedure.query(async ({ ctx }) => {
    const [people, tasks, events, rounds] = await Promise.all([
      taskPeople(),
      readTasks(),
      ctx.db.taskEvent.findMany(),
      ctx.db.taskRound.findMany(),
    ]);
    return standings(people, tasks, events, rounds, new Date());
  }),
  load: adminProcedure
    .input(
      z.object({
        from: z.date(),
        days: z.number().int().min(1).max(42).default(7),
        spanDays: z.number().int().min(1).max(7).default(1),
        gigId: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const [people, tasks] = await Promise.all([taskPeople(), readTasks()]);
      return people.map((person) => ({
        ...person,
        cells: Array.from(
          { length: Math.ceil(input.days / input.spanDays) },
          (_, i) => {
            const start = addDays(dayKey(input.from), i * input.spanDays);
            return {
              day: start,
              ...taskLoad(
                tasks
                  .filter((task) => !input.gigId || task.gigId === input.gigId)
                  .map((task) => ({ ...task, dueAt: task.projectedDueAt })),
                person.id,
                nzDate(start),
                nzDate(addDays(start, input.spanDays)),
              ),
            };
          },
        ),
      }));
    }),
  rounds: adminProcedure.query(({ ctx }) =>
    ctx.db.taskRound.findMany({
      include: {
        owedBy: { select: personFields },
        owedTo: { select: personFields },
        task: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
  ),
  settleRound: adminProcedure
    .input(
      idInput.extend({
        waive: z.boolean().default(false),
        body: reason.optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      taskTransaction(async (tx) => {
        const round = await tx.taskRound.findUnique({
          where: { id: input.id },
        });
        if (!round) throw new TRPCError({ code: "NOT_FOUND" });
        if (round.settledAt || round.waivedAt)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This round has already been resolved",
          });
        if (input.waive && !input.body)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Explain why the round is waived",
          });
        const now = new Date();
        await tx.taskEvent.create({
          data: {
            taskId: round.taskId,
            actorId: ctx.session.user.id,
            kind: input.waive ? "ROUND_WAIVED" : "ROUND_SETTLED",
            body: input.body ?? "Round settled",
            fromUserId: round.owedById,
          },
        });
        return tx.taskRound.update({
          where: { id: round.id },
          data: input.waive
            ? { waivedAt: now, settledById: ctx.session.user.id }
            : { settledAt: now, settledById: ctx.session.user.id },
        });
      }),
    ),
  setSettings: adminProcedure
    .input(taskSettingsSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.keyValueStore.upsert({
        where: { key: "tasks.settings" },
        create: { key: "tasks.settings", value: JSON.stringify(input) },
        update: { value: JSON.stringify(input) },
      }),
    ),
  calendarFeed: adminProcedure
    .input(z.object({ rotate: z.boolean().default(false) }).optional())
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.taskCalendarFeed.findUnique({
        where: { userId: ctx.session.user.id },
      });
      if (existing && !input?.rotate) return existing;
      return ctx.db.taskCalendarFeed.upsert({
        where: { userId: ctx.session.user.id },
        create: {
          userId: ctx.session.user.id,
          token: randomBytes(32).toString("base64url"),
        },
        update: { token: randomBytes(32).toString("base64url") },
      });
    }),
  createPlaybook: adminProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(100),
        items: playbookSchema,
      }),
    )
    .mutation(({ ctx, input }) => ctx.db.taskPlaybook.create({ data: input })),
  updatePlaybook: adminProcedure
    .input(
      idInput.extend({
        name: z.string().trim().min(1).max(100),
        items: playbookSchema,
      }),
    )
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.taskPlaybook.update({ where: { id }, data });
    }),
  deletePlaybook: adminProcedure
    .input(idInput)
    .mutation(({ ctx, input }) =>
      ctx.db.taskPlaybook.delete({ where: { id: input.id } }),
    ),
  applyPlaybook: adminProcedure
    .input(
      z.object({
        playbookId: z.string(),
        gigId: z.string(),
        roles: z.record(z.string(), z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tasks = await taskTransaction(async (tx) => {
        const [book, gig] = await Promise.all([
          tx.taskPlaybook.findUnique({ where: { id: input.playbookId } }),
          tx.gig.findUnique({ where: { id: input.gigId } }),
        ]);
        if (!book || !gig)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Playbook or gig not found",
          });
        const items = playbookSchema.parse(book.items);
        for (const item of items) {
          if (
            !input.roles[item.role] ||
            (item.reviewerRole && !input.roles[item.reviewerRole])
          )
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Assign ${item.role}${item.reviewerRole ? ` and ${item.reviewerRole}` : ""}`,
            });
          await requireTaskPerson(tx, input.roles[item.role]);
          if (item.reviewerRole)
            await requireTaskPerson(tx, input.roles[item.reviewerRole]);
        }
        const ids = new Map(items.map((item) => [item.key, randomUUID()]));
        const rows = [];
        for (const item of items) {
          const dueAt = new Date(
            gig.gigStartTime.getTime() + item.offsetMinutes * 60_000,
          );
          rows.push(
            await tx.task.create({
              data: {
                id: ids.get(item.key),
                title: item.title,
                notes: item.notes,
                gigId: gig.id,
                assigneeId: input.roles[item.role],
                reviewerId: item.reviewerRole
                  ? input.roles[item.reviewerRole]
                  : null,
                plannedDueAt: dueAt,
                dueAt,
                hardDeadlineAt: gig.gigStartTime,
                critical: item.critical,
                source: "PLAYBOOK",
                playbookItemId: `${book.id}:${item.key}`,
                createdById: ctx.session.user.id,
                events: {
                  create: {
                    kind: "CREATED",
                    actorId: ctx.session.user.id,
                    toUserId: input.roles[item.role],
                  },
                },
              },
            }),
          );
        }
        const deps = items.flatMap((item) =>
          item.dependsOn.map((key) => ({
            taskId: ids.get(item.key)!,
            dependsOnId: ids.get(key)!,
            gapMinutes: Math.max(
              0,
              item.offsetMinutes -
                items.find((parent) => parent.key === key)!.offsetMinutes,
            ),
          })),
        );
        orderTasks(rows, deps);
        await tx.taskDependency.createMany({ data: deps });
        return rows;
      });
      await notifyTasks(
        [],
        tasks.map((task) => task.assigneeId),
      );
      await logActivity({
        type: "TASK_CREATED",
        userId: ctx.session.user.id,
        action: `Applied task playbook (${tasks.length} tasks)`,
        details: { gigId: input.gigId, playbookId: input.playbookId },
      });
      return tasks;
    }),
  live: adminProcedure.query(async ({ ctx }) =>
    taskDayActivity(
      ctx.session.user.id,
      (await readTasks())
        .filter((task) => task.assigneeId === ctx.session.user.id)
        .map((task) => ({ ...task, dueAt: task.projectedDueAt })),
      new Date(),
    ),
  ),
  extract: adminProcedure
    .input(
      z.object({
        text: z.string().trim().min(1).max(30_000),
        imageUploadIds: z.array(z.string()).max(5).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const images = await ctx.db.file_upload.findMany({
        where: {
          id: { in: input.imageUploadIds },
          status: "OK",
          mimeType: { startsWith: "image/" },
        },
        select: { url: true },
      });
      if (images.length !== input.imageUploadIds.length)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One of the source images is unavailable",
        });
      return extractTasks({
        text: input.text,
        images: images.map((image) => image.url),
        actorId: ctx.session.user.id,
        source: "SHARE",
      });
    }),
  planGig: adminProcedure
    .input(z.object({ gigId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const gig = await ctx.db.gig.findUnique({
        where: { id: input.gigId },
        include: { tasks: true },
      });
      if (!gig) throw new TRPCError({ code: "NOT_FOUND" });
      const past = await ctx.db.task.findMany({
        where: { gig: { gigStartTime: { lt: new Date() } }, status: "DONE" },
        select: {
          title: true,
          notes: true,
          plannedDueAt: true,
          completedAt: true,
          assigneeId: true,
        },
        take: 100,
        orderBy: { completedAt: "desc" },
      });
      const books = await ctx.db.taskPlaybook.findMany();
      return extractTasks({
        text: `Gig: ${JSON.stringify(gig)}. Playbooks: ${JSON.stringify(books)}. Past completed tasks: ${JSON.stringify(past)}. Draft practical tasks and dependencies; do not duplicate tasks already present.`,
        actorId: ctx.session.user.id,
        source: "WILL_GPT",
        planningGigId: gig.id,
      });
    }),
  triage: adminProcedure
    .input(idInput.extend({ dueAt: z.date() }))
    .mutation(async ({ input }) => {
      const [tasks, people] = await Promise.all([readTasks(), taskPeople()]);
      const task = tasks.find((task) => task.id === input.id);
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      const changes = impact(
        tasks,
        tasks.flatMap((task) => task.dependencies),
        task.id,
        input.dueAt,
        new Date(),
      );
      const now = new Date();
      const load = people.map((person) => ({
        id: person.id,
        name: person.name,
        ...taskLoad(
          tasks,
          person.id,
          now,
          new Date(now.getTime() + 7 * 86400_000),
        ),
      }));
      return taskAI(
        adviceSchema,
        "delay_triage",
        `Suggest fixes without taking action. Task: ${JSON.stringify(task)}. Impact: ${JSON.stringify(changes)}. Team load: ${JSON.stringify(load)}.`,
      );
    }),
  preMortem: adminProcedure
    .input(z.object({ gigId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tasks = (await readTasks()).filter(
        (task) => task.gigId === input.gigId,
      );
      const history = await ctx.db.task.findMany({
        where: { gigId: { not: null }, completedAt: { not: null } },
        select: {
          title: true,
          plannedDueAt: true,
          submittedAt: true,
          assigneeId: true,
        },
        take: 200,
        orderBy: { completedAt: "desc" },
      });
      return taskAI(
        adviceSchema,
        "gig_pre_mortem",
        `Identify realistic risks from this gig and historical slips. Do not invent a pattern. Current tasks: ${JSON.stringify(tasks)}. Completed history: ${JSON.stringify(history)}.`,
      );
    }),
  suggestGap: adminProcedure
    .input(idInput.extend({ dependsOnId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [task, parent] = await Promise.all([
        requireTask(ctx.db, input.id),
        requireTask(ctx.db, input.dependsOnId),
      ]);
      const words = task.title
        .split(/\s+/)
        .filter((word) => word.length > 3)
        .slice(0, 3);
      const history = await ctx.db.task.findMany({
        where: {
          status: "DONE",
          startedAt: { not: null },
          submittedAt: { not: null },
          OR: words.map((word) => ({
            title: { contains: word, mode: "insensitive" as const },
          })),
        },
        select: { startedAt: true, submittedAt: true },
        take: 30,
      });
      const durations = history
        .flatMap((row) =>
          row.startedAt && row.submittedAt
            ? [
                Math.max(
                  0,
                  Math.round(
                    (row.submittedAt.getTime() - row.startedAt.getTime()) /
                      60_000,
                  ),
                ),
              ]
            : [],
        )
        .sort((a, b) => a - b);
      return {
        gapMinutes: durations.length
          ? durations[Math.floor(durations.length / 2)]!
          : Math.max(
              0,
              Math.round(
                (task.plannedDueAt.getTime() - parent.plannedDueAt.getTime()) /
                  60_000,
              ),
            ),
        samples: durations.length,
      };
    }),
  attachProof: adminProcedure
    .input(idInput.extend({ uploadId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const task = await taskTransaction(async (tx) => {
        const task = await requireTask(tx, input.id);
        const file = await tx.file_upload.findUnique({
          where: { id: input.uploadId },
        });
        if (
          file?.status !== "OK" ||
          !file.mimeType.startsWith("image/") ||
          file.for !== "task" ||
          file.forId !== task.id
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Upload a proof image for this task",
          });
        await tx.taskEvent.create({
          data: {
            taskId: task.id,
            actorId: ctx.session.user.id,
            kind: "PROOF_ADDED",
            body: `Proof attached: ${file.name}`,
          },
        });
        return tx.task.update({
          where: { id: task.id },
          data: { proofUploadId: file.id, proofAssessment: null },
        });
      });
      return task;
    }),
  assessProof: adminProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) => {
      const task = await requireTask(ctx.db, input.id);
      const file = task.proofUploadId
        ? await ctx.db.file_upload.findUnique({
            where: { id: task.proofUploadId },
          })
        : null;
      if (!file)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Attach proof first",
        });
      const result = await taskAI(
        z.object({ plausible: z.boolean(), reason: z.string().max(2000) }),
        "proof_check",
        `Does this image plausibly show completion of '${task.title}'? Notes: ${task.notes ?? ""}. This is advisory, never automatic sign-off.`,
        [file.url],
      );
      await ctx.db.task.updateMany({
        where: { id: task.id, proofUploadId: file.id },
        data: {
          proofAssessment: `${result.plausible ? "Plausible" : "Needs human review"}: ${result.reason}`,
        },
      });
      return result;
    }),
});
