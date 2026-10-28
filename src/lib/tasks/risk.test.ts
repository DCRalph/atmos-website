import { describe, expect, test } from "bun:test";
import { explainRisk, formatSpan, type RiskTask } from "./risk";
import {
  projectSchedule,
  type Dependency,
  type ScheduleTask,
} from "./schedule";
import { formatTaskDate } from "./time";

const hour = 3600_000;
const day = 24 * hour;
const now = new Date("2026-10-28T02:00:00Z");
const gigStart = new Date(now.getTime() + 2 * day);

/** Projects the tasks and returns what `explainRisk` reads, by id. */
function project(
  tasks: (Partial<ScheduleTask> &
    Pick<ScheduleTask, "id" | "title" | "dueAt">)[],
  dependencies: Dependency[],
) {
  const rows = tasks.map((task) => ({
    status: "TODO" as const,
    assigneeId: "ana",
    plannedDueAt: task.dueAt,
    hardDeadlineAt: null,
    completedAt: null,
    submittedAt: null,
    ...task,
  }));
  const projected = projectSchedule(rows, dependencies, now);
  return new Map<string, RiskTask>(
    rows.map((row) => [
      row.id,
      {
        ...row,
        ...projected.get(row.id)!,
        dependencies: dependencies.filter((dep) => dep.taskId === row.id),
        gig: { gigStartTime: gigStart },
      },
    ]),
  );
}

describe("why a task is at risk", () => {
  test("names what it waits on and what's actually late, and how far past the gig it lands", () => {
    const tasks = project(
      [
        {
          id: "lineup",
          title: "Lock the line-up",
          dueAt: new Date(now.getTime() - 5 * day),
        },
        {
          id: "poster",
          title: "Poster design",
          dueAt: new Date(now.getTime() + day),
        },
        {
          id: "announce",
          title: "Announce the night",
          dueAt: new Date(now.getTime() + 1.5 * day),
          hardDeadlineAt: gigStart,
        },
      ],
      [
        { taskId: "poster", dependsOnId: "lineup", gapMinutes: 2 * 1440 },
        { taskId: "announce", dependsOnId: "poster", gapMinutes: 1440 },
      ],
    );
    const announce = tasks.get("announce")!;
    const reason = explainRisk(announce, tasks, now)!;
    expect(reason.causes.map((cause) => cause.id)).toEqual([
      "poster",
      "lineup",
    ]);
    expect(reason.short).toBe(
      "Waits on Poster design, held up by Lock the line-up (5 days late)",
    );
    expect(reason.detail).toContain("It needs 1 day after that");
    expect(reason.detail).toContain(formatTaskDate(announce.requiredDueAt));
    expect(reason.detail).toContain(
      `1 day after the gig starts (${formatTaskDate(gigStart)})`,
    );
  });

  test("a task due after its own deadline says so", () => {
    const tasks = project(
      [
        {
          id: "kit",
          title: "Door kit",
          dueAt: new Date(gigStart.getTime() + 3 * hour),
          hardDeadlineAt: gigStart,
        },
      ],
      [],
    );
    const reason = explainRisk(tasks.get("kit")!, tasks, now)!;
    expect(reason.short).toBe("Due after the gig starts");
    expect(reason.detail).toContain("3 hours after the gig starts");
    expect(reason.causes).toEqual([]);
  });

  test("a task with room before its deadline has nothing to explain", () => {
    const tasks = project(
      [
        {
          id: "kit",
          title: "Door kit",
          dueAt: new Date(now.getTime() + day),
          hardDeadlineAt: gigStart,
        },
      ],
      [],
    );
    expect(explainRisk(tasks.get("kit")!, tasks, now)).toBe(null);
  });

  test("a finished task ends the chain: what held it up no longer matters", () => {
    const done = new Date(now.getTime() - day);
    const tasks = project(
      [
        {
          id: "lineup",
          title: "Lock the line-up",
          dueAt: new Date(now.getTime() - 5 * day),
        },
        {
          id: "poster",
          title: "Design the poster",
          dueAt: new Date(now.getTime() - 3 * day),
          status: "DONE",
          completedAt: done,
        },
        {
          id: "announce",
          title: "Announce the night",
          dueAt: new Date(now.getTime() + day),
          hardDeadlineAt: gigStart,
        },
      ],
      [
        { taskId: "poster", dependsOnId: "lineup", gapMinutes: 3 * 1440 },
        { taskId: "announce", dependsOnId: "poster", gapMinutes: 4 * 1440 },
      ],
    );
    const reason = explainRisk(tasks.get("announce")!, tasks, now)!;
    expect(reason.causes.map((cause) => cause.id)).toEqual(["poster"]);
    expect(reason.short).toBe(
      `Waits on Design the poster (done ${formatTaskDate(done)})`,
    );
    expect(reason.detail).toContain("It needs 4 days after that");
  });

  test("gaps read exactly, in the largest units first", () => {
    expect(formatSpan(3 * 1440)).toBe("3 days");
    expect(formatSpan(90)).toBe("1 hour 30 minutes");
    expect(formatSpan(36 * 60)).toBe("1 day 12 hours");
    expect(formatSpan(1)).toBe("1 minute");
  });
});
