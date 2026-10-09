import { test, mock } from "bun:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import type { createTRPCContext } from "./api/trpc";
import type { publish } from "./notify";
import type { sendPush } from "./push";

// Opt in with a disposable, schema-initialised database. Never fall back to .env.
const testUrl = process.env.TASKS_TEST_DATABASE_URL;
if (testUrl) {
  const parsed = new URL(testUrl);
  if (
    !["localhost", "127.0.0.1"].includes(parsed.hostname) ||
    parsed.pathname !== "/atmos_tasks_test"
  )
    throw new Error(
      "Tasks integration tests require a local atmos_tasks_test database",
    );
  process.env.DATABASE_URL = testUrl;
  Object.assign(process.env, {
    NODE_ENV: "test",
    NEXT_PUBLIC_APP_URL: "http://localhost:3001",
    BETTER_AUTH_SECRET: "local-test-session-secret",
    RESEND_API_KEY: "re_local_only",
    RESEND_INBOUND_SECRET: `whsec_${Buffer.from("local-test-signing-key").toString("base64")}`,
    TASKS_INBOUND_ADDRESS: "tasks@example.test",
    TASKS_FORWARDERS: "{}",
    OPENROUTER_API_KEY: "local-test-only",
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: "",
    SHOPIFY_PRIVATE_ACCESS_TOKEN: "",
    GOOGLE_CLIENT_SECRET: "",
    INSTAGRAM_ACCESS_TOKEN: "",
    R2_ACCESS_KEY_ID: "",
    R2_SECRET_ACCESS_KEY: "",
  });
  process.env.SKIP_ENV_VALIDATION = "1";
  const pushes: Parameters<typeof sendPush>[0][] = [];
  mock.module("~/server/push", () => ({
    sendPush: async (input: Parameters<typeof sendPush>[0]) => {
      pushes.push(input);
      return { sent: 0, removed: 0 };
    },
    sendSilentPush: async () => ({ sent: 0, removed: 0 }),
    countAudience: async () => 0,
  }));
  const published: Parameters<typeof publish>[0][] = [];
  mock.module("~/server/notify", () => ({
    publish: async (input: Parameters<typeof publish>[0]) => {
      published.push(input);
      return { delivery: { devices: 0, delivered: 0 } };
    },
  }));
  let modelCalls = 0;
  mock.module("~/server/will-gpt/openrouter", () => ({
    openRouter: () => ({
      chat: {
        completions: {
          create: async () => {
            modelCalls++;
            return {
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      tasks: [
                        {
                          title: "Email commitment",
                          notes: null,
                          assignee: "Ana",
                          dueAt: null,
                          gigId: null,
                          quote: "Ana will send the rider",
                          critical: false,
                          dependsOn: [],
                        },
                      ],
                    }),
                  },
                },
              ],
            };
          },
        },
      },
    }),
  }));
  const { Resend: RealResend } = await import("resend");
  const webhooks = new RealResend("re_local_only").webhooks;
  const verify = webhooks.verify.bind(webhooks);
  let dmarc = "fail";
  mock.module("resend", () => ({
    Resend: class {
      webhooks = { verify };
      emails = {
        receiving: {
          get: async () => ({
            error: null,
            data: {
              text: "Ana will send the rider",
              authentication: { dmarc },
              headers: { "Authentication-Results": "spoofed; dmarc=pass" },
            },
          }),
        },
      };
    },
  }));
  const { db } = await import("./db");
  const { tasksRouter } = await import("./api/routers/tasks");
  const { sweepTasks } = await import("./tasks");
  const { extractTasks } = await import("./tasks/extract");
  const { GET: calendar } =
    await import("~/app/api/tasks/calendar/[token]/route");
  const { POST: inbound } =
    await import("~/app/api/webhooks/inbound-email/route");
  type Context = Awaited<ReturnType<typeof createTRPCContext>>;
  const session = (
    id: string,
    name: string,
  ): NonNullable<Context["session"]> => ({
    user: {
      id,
      name,
      email: `${id}@example.test`,
      emailVerified: true,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    session: {
      id: `session-${id}`,
      token: `token-${id}`,
      userId: id,
      expiresAt: new Date(Date.now() + 86400_000),
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
  });
  const caller = (id: string, name: string) =>
    tasksRouter.createCaller({
      db,
      session: session(id, name),
      headers: new Headers(),
    });
  test("admin gates, transactional graph changes, reminder reservations and inbox dedupe", async () => {
    try {
      await db.task.deleteMany();
      await db.taskInboxReceipt.deleteMany();
      await db.taskBatchFire.deleteMany();
      for (const [id, name, permission] of [
        ["task-test-a", "Ana", "ADMIN"],
        ["task-test-b", "Ben", "SUPERADMIN"],
        ["task-test-o", "Organiser", "EVENT_ORGANISER"],
      ] as const) {
        await db.user.upsert({
          where: { id },
          create: {
            id,
            name,
            email: `${id}@example.test`,
            emailVerified: true,
            permissions: { create: { permission } },
          },
          update: { permissions: { deleteMany: {}, create: { permission } } },
        });
      }
      const ana = caller("task-test-a", "Ana"),
        ben = caller("task-test-b", "Ben"),
        organiser = caller("task-test-o", "Organiser");
      await assert.rejects(organiser.list(), /admin permission required/);
      const anon = tasksRouter.createCaller({
        db,
        session: null,
        headers: new Headers(),
      });
      await assert.rejects(anon.list(), /UNAUTHORIZED/);
      const due = new Date(Date.now() + 86400_000);
      await assert.rejects(
        ana.create({
          title: "Wrong owner",
          assigneeId: "task-test-o",
          dueAt: due,
        }),
        /must be admins/,
      );
      const countBefore = await db.task.count();
      await assert.rejects(
        ana.create({
          title: "Atomic creation",
          assigneeId: "task-test-a",
          dueAt: due,
          dependsOnId: "missing-parent",
        }),
        /not found/,
      );
      assert.equal(await db.task.count(), countBefore);
      const blocked = await ana.create({
        title: "Venue reply",
        assigneeId: "task-test-a",
        dueAt: due,
      });
      await ana.setStatus({
        id: blocked.id,
        status: "BLOCKED",
        body: "Waiting on venue",
        checkBackAt: due,
      });
      const checkBackAt = new Date(due.getTime() + 3600_000);
      await ana.setStatus({
        id: blocked.id,
        status: "BLOCKED",
        body: "Venue said tomorrow",
        checkBackAt,
      });
      assert.equal(
        (await ana.get({ id: blocked.id })).checkBackAt?.getTime(),
        checkBackAt.getTime(),
      );
      await ana.nudge({ id: blocked.id });
      assert(
        (await ana.get({ id: blocked.id })).timeline.some(
          (event) => event.kind === "NUDGED" && event.actorId === "task-test-a",
        ),
      );
      const parent = await ana.create({
        title: "Design poster",
        assigneeId: "task-test-a",
        reviewerId: "task-test-b",
        dueAt: due,
      });
      const child = await ana.create({
        title: "Print posters",
        assigneeId: "task-test-b",
        dueAt: new Date(due.getTime() + 3600_000),
        dependsOnId: parent.id,
      });
      assert.equal(
        (await ana.get({ id: child.id })).dependencies[0]?.gapMinutes,
        60,
      );
      await assert.rejects(
        ana.addDependency({ id: parent.id, dependsOnId: child.id }),
        /cycle/i,
      );
      await assert.rejects(
        ben.setStatus({ id: child.id, status: "DONE" }),
        /dependencies/,
      );
      const later = new Date(due.getTime() + 86400_000);
      await ana.reportDelay({
        id: parent.id,
        dueAt: later,
        body: "Venue has not approved it",
      });
      const moved = await ben.get({ id: child.id });
      assert.equal(moved.dueAt.getTime(), later.getTime() + 3600_000);
      assert.equal(moved.plannedDueAt.getTime(), child.plannedDueAt.getTime());
      assert(
        moved.timeline.some(
          (event) =>
            event.kind === "SHIFTED" && event.causeTaskId === parent.id,
        ),
      );
      await ana.setStatus({ id: parent.id, status: "IN_REVIEW" });
      await assert.rejects(
        ben.setStatus({ id: child.id, status: "DONE" }),
        /dependencies/,
      );
      await ben.setStatus({ id: parent.id, status: "DONE" });
      assert.equal((await ben.get({ id: child.id })).waiting, false);
      const scores = await ana.standings();
      assert.equal(scores.find((p) => p.id === "task-test-a")?.onTime, 1);
      assert.equal(scores.find((p) => p.id === "task-test-b")?.onTime, 0);
      const proof = await ana.create({
        title: "Posters up",
        assigneeId: "task-test-a",
        dueAt: due,
        proofRequired: true,
        critical: true,
      });
      await ana.update({
        id: proof.id,
        notes: "Keep the completion requirements",
      });
      const preserved = await ana.get({ id: proof.id });
      assert.equal(preserved.proofRequired, true);
      assert.equal(preserved.critical, true);
      await assert.rejects(
        ana.setStatus({ id: proof.id, status: "DONE" }),
        /proof/,
      );
      const photo = await db.file_upload.create({
        data: {
          url: `https://example.test/${proof.id}`,
          key: proof.id,
          name: "proof.jpg",
          type: "image",
          size: 10,
          mimeType: "image/jpeg",
          for: "task",
          forId: proof.id,
        },
      });
      await ana.attachProof({ id: proof.id, uploadId: photo.id });
      await db.file_upload.delete({ where: { id: photo.id } });
      await assert.rejects(
        ana.setStatus({ id: proof.id, status: "DONE" }),
        /proof/,
      );
      await ana.offer({ id: proof.id });
      const rescue = await Promise.allSettled([
        ben.take({ id: proof.id }),
        ana.take({ id: proof.id }),
      ]);
      assert.equal(rescue.filter((r) => r.status === "fulfilled").length, 1);
      const proposal = await db.task.create({
        data: {
          title: "Accept once",
          status: "PROPOSED",
          createdById: "task-test-a",
          dueAt: due,
          plannedDueAt: due,
        },
      });
      const outcomes = await Promise.allSettled([
        ana.accept({ id: proposal.id, assigneeId: "task-test-a", dueAt: due }),
        ben.accept({ id: proposal.id, assigneeId: "task-test-b", dueAt: due }),
      ]);
      assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
      await assert.rejects(ana.dismiss({ id: proposal.id }), /Only proposals/);
      assert.equal(
        (await db.task.findUniqueOrThrow({ where: { id: proposal.id } }))
          .status,
        "TODO",
      );
      const batch = await db.task.createManyAndReturn({
        data: ["Batch one", "Batch two"].map((title) => ({
          title,
          status: "PROPOSED",
          dueAt: due,
          plannedDueAt: due,
        })),
      });
      await assert.rejects(
        ana.acceptMany({
          proposals: batch.map((task, i) => ({
            id: task.id,
            assigneeId: i ? "task-test-o" : "task-test-a",
            dueAt: due,
          })),
        }),
        /must be admins/,
      );
      assert.equal(
        await db.task.count({
          where: {
            id: { in: batch.map((task) => task.id) },
            status: "PROPOSED",
          },
        }),
        2,
      );
      const accepted = await ana.acceptMany({
        proposals: batch.map((task) => ({
          id: task.id,
          assigneeId: "task-test-a",
          dueAt: due,
        })),
      });
      assert.equal(accepted.length, 2);
      const feed = await ana.calendarFeed();
      assert.equal((await ana.calendarFeed()).token, feed.token);
      const feedRequest = (token: string) =>
        calendar(new Request("http://localhost/feed"), {
          params: Promise.resolve({ token: `${token}.ics` }),
        });
      assert.equal((await feedRequest(feed.token)).status, 200);
      assert.match(
        await (await feedRequest(feed.token)).text(),
        /BEGIN:VCALENDAR/,
      );
      const replacement = await ana.calendarFeed({ rotate: true });
      assert.notEqual(replacement.token, feed.token);
      assert.equal((await feedRequest(feed.token)).status, 404);
      // One latest reminder per task, even with two overlapping tickers after downtime.
      const now = new Date("2026-10-09T12:00:00+13:00");
      const overdue = await db.task.create({
        data: {
          title: "Catch up",
          assigneeId: "task-test-a",
          dueAt: new Date(now.getTime() - 28 * 3600_000),
          plannedDueAt: new Date(now.getTime() - 28 * 3600_000),
        },
      });
      await ana.setSettings({ roundsEnabled: true, nagVoice: false });
      await Promise.all([sweepTasks(now), sweepTasks(now)]);
      const fires = await db.taskNudge.findMany({
        where: { taskId: overdue.id, skipped: false, step: { not: "created" } },
      });
      assert.equal(fires.length, 1);
      assert(
        (await db.taskNudge.count({
          where: { taskId: overdue.id, skipped: true },
        })) > 0,
      );
      assert(
        published.some((notice) => notice.click === `/tasks/${overdue.id}`),
      );
      const round = await db.taskRound.findFirstOrThrow({
        where: { taskId: overdue.id, reason: "SILENT_MISS" },
      });
      await assert.rejects(
        ana.settleRound({ id: round.id, waive: true }),
        /Explain why/,
      );
      await ana.settleRound({
        id: round.id,
        waive: true,
        body: "The venue was responsible",
      });
      await assert.rejects(
        ben.settleRound({ id: round.id }),
        /already been resolved/,
      );
      const risk = await db.task.create({
        data: {
          title: "Risk keeps following up",
          assigneeId: "task-test-a",
          dueAt: new Date(now.getTime() - 3600_000),
          plannedDueAt: new Date(now.getTime() - 3600_000),
          hardDeadlineAt: new Date(now.getTime() - 2 * 3600_000),
        },
      });
      await sweepTasks(now);
      await sweepTasks(new Date(now.getTime() + 5 * 3600_000));
      assert.equal(
        await db.taskNudge.count({
          where: { taskId: risk.id, step: "at-risk", skipped: false },
        }),
        1,
      );
      assert(
        (await db.taskNudge.count({
          where: {
            taskId: risk.id,
            step: { startsWith: "overdue" },
            skipped: false,
          },
        })) > 0,
      );
      const gig = await db.gig.create({
        data: {
          title: "Automation test",
          subtitle: "Test only",
          gigStartTime: new Date(now.getTime() + 7 * 86400_000),
        },
      });
      const automatic = await ana.create({
        title: "Publish tickets",
        assigneeId: "task-test-a",
        reviewerId: "task-test-b",
        gigId: gig.id,
        dueAt: new Date(now.getTime() + 86400_000),
        automation: { kind: "TICKETS_PUBLISHED" },
      });
      await sweepTasks(now);
      assert.equal((await ana.get({ id: automatic.id })).status, "TODO");
      await db.ticketEvent.create({
        data: {
          name: "Automation test tickets",
          slug: `task-test-${gig.id}`,
          gigId: gig.id,
          status: "PUBLISHED",
          startsAt: gig.gigStartTime,
        },
      });
      await sweepTasks(now);
      assert.equal((await ana.get({ id: automatic.id })).status, "IN_REVIEW");
      const source = {
        text: "Ana will send the rider",
        actorId: "task-test-a",
        source: "EMAIL" as const,
        sourceRef: "local-email-test",
      };
      const one = await extractTasks(source),
        two = await extractTasks(source);
      assert.equal(modelCalls, 1);
      assert.equal(one[0]?.id, two[0]?.id);
      assert.equal(one[0]?.status, "PROPOSED");
      const payload = JSON.stringify({
        type: "email.received",
        data: {
          from: "task-test-a@example.test",
          to: ["tasks@example.test"],
          cc: [],
          received_for: [],
          email_id: "signed-inbound-test",
          subject: "Rider",
          created_at: new Date().toISOString(),
        },
      });
      const timestamp = String(Math.floor(Date.now() / 1000)),
        eventId = "local-inbound-event";
      const signature = createHmac("sha256", "local-test-signing-key")
        .update(`${eventId}.${timestamp}.${payload}`)
        .digest("base64");
      const emailRequest = (signatureValue = `v1,${signature}`) =>
        new Request("http://localhost/api/webhooks/inbound-email", {
          method: "POST",
          body: payload,
          headers: {
            "svix-id": eventId,
            "svix-timestamp": timestamp,
            "svix-signature": signatureValue,
          },
        });
      assert.equal((await inbound(emailRequest("invalid"))).status, 401);
      assert.equal((await inbound(emailRequest())).status, 204);
      assert.equal(
        await db.task.count({ where: { sourceRef: "signed-inbound-test" } }),
        0,
      );
      dmarc = "pass";
      assert.equal((await inbound(emailRequest())).status, 200);
      assert.equal((await inbound(emailRequest())).status, 200);
      assert.equal(
        await db.task.count({ where: { sourceRef: "signed-inbound-test" } }),
        1,
      );
      // Permission loss becomes an unassigned alert and is recoverable by another admin.
      const lost = await ana.create({
        title: "Lost permission",
        assigneeId: "task-test-a",
        dueAt: due,
      });
      await db.userPermissionAssignment.deleteMany({
        where: { userId: "task-test-a" },
      });
      const orphan = (await ben.alerts()).find((t) => t.id === lost.id);
      assert(orphan?.unassigned);
      assert.equal((await feedRequest(replacement.token)).status, 404);
      await db.task.update({
        where: { id: lost.id },
        data: {
          dueAt: new Date(now.getTime() - 3600_000),
          hardDeadlineAt: new Date(now.getTime() - 2 * 3600_000),
        },
      });
      await sweepTasks(now);
      assert.equal(
        await db.taskNudge.count({
          where: { taskId: lost.id, step: "at-risk", skipped: false },
        }),
        1,
      );
      await assert.rejects(ana.list(), /admin permission/);
      await ben.take({ id: lost.id });
    } finally {
      await db.$disconnect();
    }
  }, 120_000);
}
