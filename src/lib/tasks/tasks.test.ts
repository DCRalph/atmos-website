import { describe, test, expect } from "bun:test";
import {
  projectSchedule,
  impact,
  orderTasks,
  type ScheduleTask,
} from "./schedule";
import { transitionFor } from "./status";
import { taskPushBody } from "./push-copy";
import { nudgeSteps, wakingAt, addWakingHours } from "./nudges";
import { taskLoad } from "./load";
import { taskDayActivity } from "./live-activity";
import { standings } from "./standings";
import { taskCalendar } from "./calendar";
import { nzDate } from "./time";
import { playbookSchema } from "./input";
const at = (time: string) => new Date(`2026-10-09T${time}:00+13:00`);
const task = (id: string, dueAt = at("12:00")): ScheduleTask => ({
  id,
  title: id,
  status: "TODO",
  assigneeId: "a",
  dueAt,
  plannedDueAt: dueAt,
  hardDeadlineAt: null,
  completedAt: null,
  submittedAt: null,
});
describe("task schedule", () => {
  test("late dependencies slide at read time without mutating commitments", () => {
    const tasks = [task("poster", at("09:00")), task("print", at("11:00"))];
    const state = projectSchedule(
      tasks,
      [{ taskId: "print", dependsOnId: "poster", gapMinutes: 120 }],
      at("12:00"),
    ).get("print")!;
    expect(state.projectedDueAt).toEqual(at("14:00"));
    expect(state.waiting).toBe(true);
    expect(tasks[1]!.dueAt).toEqual(at("11:00"));
  });
  test("DONE releases a dependency; submitted work does not", () => {
    const parent = {
      ...task("poster"),
      status: "IN_REVIEW" as const,
      submittedAt: at("10:00"),
    };
    const child = task("print");
    const deps = [{ taskId: "print", dependsOnId: "poster", gapMinutes: 60 }];
    expect(
      projectSchedule([parent, child], deps, at("13:00")).get("print")!.waiting,
    ).toBe(true);
    const done = {
      ...parent,
      status: "DONE" as const,
      completedAt: at("13:00"),
    };
    expect(
      projectSchedule([done, child], deps, at("13:00")).get("print")!
        .projectedDueAt,
    ).toEqual(at("14:00"));
  });
  test("deadline caps do not conceal risk further down a chain", () => {
    const tasks = [
      task("a", at("09:00")),
      { ...task("b", at("10:00")), hardDeadlineAt: at("11:00") },
      { ...task("c", at("11:00")), hardDeadlineAt: at("13:00") },
    ];
    const deps = [
      { taskId: "b", dependsOnId: "a", gapMinutes: 60 },
      { taskId: "c", dependsOnId: "b", gapMinutes: 120 },
    ];
    const state = projectSchedule(tasks, deps, at("12:00"));
    expect(state.get("b")!.projectedDueAt).toEqual(at("11:00"));
    expect(state.get("b")!.requiredDueAt).toEqual(at("13:00"));
    expect(state.get("c")!.shortMinutes).toBe(120);
  });
  test("cycles and missing tasks are refused", () => {
    expect(() =>
      orderTasks(
        [task("a"), task("b")],
        [
          { taskId: "a", dependsOnId: "b", gapMinutes: 0 },
          { taskId: "b", dependsOnId: "a", gapMinutes: 0 },
        ],
      ),
    ).toThrow("cycle");
    expect(() =>
      orderTasks(
        [task("a")],
        [{ taskId: "a", dependsOnId: "missing", gapMinutes: 0 }],
      ),
    ).toThrow("exists");
  });
  test("impact contains downstream work only, with no writes", () => {
    const tasks = [task("a"), task("b", at("13:00")), task("c")];
    const changed = impact(
      tasks,
      [{ taskId: "b", dependsOnId: "a", gapMinutes: 60 }],
      "a",
      at("15:00"),
      at("10:00"),
    );
    expect(changed.map((row) => row.taskId)).toEqual(["b"]);
    expect(changed[0]!.shiftMinutes).toBe(180);
  });
});
describe("statuses", () => {
  test("review cannot be bypassed or fabricated", () => {
    expect(transitionFor("TODO", "DONE", true)).toBeUndefined();
    expect(transitionFor("TODO", "IN_REVIEW", false)).toBeUndefined();
    expect(transitionFor("IN_REVIEW", "IN_PROGRESS", true)?.reason).toBe(true);
    expect(transitionFor("DONE", "IN_PROGRESS", false)?.who).toBe("admin");
    expect(transitionFor("BLOCKED", "BLOCKED", false)?.reason).toBe(true);
  });
});
describe("reminders and NZ time", () => {
  test("quiet hours cross midnight and daylight-saving changes", () => {
    expect(wakingAt(at("23:00"))).toEqual(
      new Date("2026-10-10T08:00:00+13:00"),
    );
    expect(nzDate("2026-06-01", 8)).toEqual(
      new Date("2026-06-01T08:00:00+12:00"),
    );
    expect(nzDate("2026-10-09", 8)).toEqual(at("08:00"));
    expect(addWakingHours(at("21:00"), 4)).toEqual(
      new Date("2026-10-10T11:00:00+13:00"),
    );
    expect(wakingAt(at("23:00"), at("20:00"))).toEqual(at("23:00"));
    expect(addWakingHours(at("02:00"), 4, at("20:00"))).toEqual(at("06:00"));
    expect(addWakingHours(at("23:00"), 4, at("20:00"))).toEqual(
      new Date("2026-10-10T11:00:00+13:00"),
    );
  });
  test("waiting and proposals have no ladder, review nags only after submission", () => {
    const input = {
      status: "TODO" as const,
      dueAt: at("12:00"),
      critical: false,
      checkBackAt: null,
      submittedAt: null,
      waiting: false,
      atRisk: false,
    };
    expect(nudgeSteps({ ...input, waiting: true }, at("18:00"))).toEqual([]);
    expect(nudgeSteps({ ...input, status: "PROPOSED" }, at("18:00"))).toEqual(
      [],
    );
    expect(
      nudgeSteps(
        { ...input, status: "IN_REVIEW", submittedAt: at("10:00") },
        at("18:00"),
      ),
    ).toEqual([]);
    expect(nudgeSteps(input, at("16:00")).at(-1)?.step).toBe("overdue-0");
  });
  test("critical tasks escalate at six hours", () => {
    const steps = nudgeSteps(
      {
        status: "TODO",
        dueAt: at("08:00"),
        critical: true,
        checkBackAt: null,
        submittedAt: null,
        waiting: false,
        atRisk: false,
      },
      at("14:00"),
    );
    expect(steps.at(-1)?.step).toBe("escalated");
  });
});
test("load weights critical and waiting work and excludes completed work", () => {
  const rows = [
    { ...task("a"), critical: true, waiting: false },
    { ...task("b"), critical: false, waiting: true },
    { ...task("c"), status: "DONE" as const, critical: true, waiting: false },
  ];
  expect(taskLoad(rows, "a", at("08:00"), at("20:00"))).toEqual({
    count: 2,
    weighted: 2.5,
    taskIds: ["a", "b"],
  });
});
test("push copy leaves room for routing data even with long Unicode reasons", () => {
  const copy = taskPushBody("🙂".repeat(4000));
  expect(new TextEncoder().encode(copy).length < 2500).toBe(true);
  expect(copy.endsWith("…")).toBe(true);
  expect(copy.includes("�")).toBe(false);
});
test("native activity chooses actionable work due today and ends with the last task", () => {
  const rows = [
    {
      ...task("a", at("15:00")),
      createdAt: at("08:00"),
      startedAt: null,
      actionableAt: at("09:00"),
      waiting: false,
    },
    {
      ...task("b", at("13:00")),
      createdAt: at("08:00"),
      startedAt: null,
      waiting: true,
    },
  ];
  expect(taskDayActivity("a", rows, at("11:00")).currentName).toBe("a");
  expect(taskDayActivity("a", rows, at("11:00")).currentStartsAt).toBe(
    Math.floor(at("09:00").getTime() / 1000),
  );
  expect(
    taskDayActivity(
      "a",
      rows.map((row) => ({ ...row, status: "DONE" })),
      at("11:00"),
    ).active,
  ).toBe(false);
});
test("standings count submitted work once and attribute it to its submitter", () => {
  const row = {
    ...task("x", at("12:00")),
    assigneeId: "b",
    status: "DONE" as const,
    submittedAt: at("11:00"),
    completedAt: at("16:00"),
  };
  const event = {
    taskId: "x",
    actorId: "a",
    kind: "STATUS_CHANGED",
    createdAt: at("11:00"),
    fromDueAt: at("12:00"),
    fromUserId: null,
    toUserId: "a",
    fromStatus: "IN_PROGRESS" as const,
    toStatus: "IN_REVIEW" as const,
  };
  const result = standings(
    [
      { id: "a", name: "Ana" },
      { id: "b", name: "Josh" },
    ],
    [row],
    [
      event,
      {
        ...event,
        actorId: "b",
        createdAt: at("16:00"),
        fromStatus: "IN_REVIEW",
        toStatus: "DONE",
      },
    ],
    [],
    at("18:00"),
  );
  expect(result[0]!.onTime).toBe(1);
  expect(result[1]!.onTime).toBe(0);
});
test("calendar escapes injected lines and folds non-ASCII safely", () => {
  const ics = taskCalendar(
    [
      {
        id: "x",
        title: "Poster, Māori; " + "🎵".repeat(40) + "\nEND:VEVENT",
        startsAt: at("12:00"),
        updatedAt: at("10:00"),
        url: "https://atmosmedia.co.nz/admin/tasks?task=x",
      },
    ],
    at("11:00"),
  );
  expect(ics).toContain("Poster\\, Māori\\;");
  expect(ics).toContain("\\nEND:VEVENT");
  for (const line of ics.split("\r\n"))
    expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
});
test("playbooks reject cyclic or unknown dependency keys", () => {
  const item = {
    key: "a",
    title: "A",
    offsetMinutes: -100,
    role: "promo",
    dependsOn: ["b"],
  };
  expect(playbookSchema.safeParse([item]).success).toBe(false);
  expect(
    playbookSchema.safeParse([item, { ...item, key: "b", dependsOn: ["a"] }])
      .success,
  ).toBe(false);
});
