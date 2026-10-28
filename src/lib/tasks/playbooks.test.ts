import { describe, expect, test } from "bun:test";
import { playbookSchema, storedPlaybookSchema } from "./input";
import {
  formatTaskWhen,
  formatWhen,
  moveWhen,
  playbookDueAt,
  playbookPlan,
  renameRole,
  sampleGig,
  type PlaybookGig,
  type PlaybookWhen,
  type Weekday,
} from "./playbooks";
import { STARTER_PLAYBOOKS } from "./starter-playbooks";
import { dayKey, nzDate, nzParts } from "./time";

/** `2026-12-07 17:00` in NZ time. */
const nz = (date: Date) => {
  const { hour, minute } = nzParts(date);
  return `${dayKey(date)} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

/** A 9pm gig on an NZ calendar day. */
const gigOn = (day: string): PlaybookGig => ({ startsAt: nzDate(day, 21) });
const due = (when: PlaybookWhen, gig: PlaybookGig, time?: string) =>
  nz(playbookDueAt({ when, time }, gig, "17:00").dueAt);

const saturday = gigOn("2026-12-12");
const monday = gigOn("2026-12-07");

describe("when a playbook task lands", () => {
  test("weekday rules count from the gig, never landing on the gig day", () => {
    const monBefore: PlaybookWhen = {
      kind: "weekday",
      day: "mon",
      side: "before",
      weeks: 0,
    };
    expect(due(monBefore, saturday)).toBe("2026-12-07 17:00");
    // On a Monday gig the Monday before is a week earlier.
    expect(due(monBefore, monday)).toBe("2026-11-30 17:00");
    expect(due({ ...monBefore, weeks: 3 }, saturday)).toBe("2026-11-16 17:00");
    expect(
      due({ kind: "weekday", day: "wed", side: "after", weeks: 0 }, saturday),
    ).toBe("2026-12-16 17:00");
  });

  test("weekdays only moves a weekend date to the Friday before, or the Monday after", () => {
    const print = playbookDueAt(
      { when: { kind: "days", days: -21, weekdays: true } },
      saturday,
      "17:00",
    );
    expect(nz(print.dueAt)).toBe("2026-11-20 17:00");
    expect(print.movedFrom).toBe("2026-11-21");
    expect(due({ kind: "days", days: 1, weekdays: true }, saturday)).toBe(
      "2026-12-14 17:00",
    );
    expect(due({ kind: "days", days: -10, weekdays: true }, saturday)).toBe(
      "2026-12-02 17:00",
    );
  });

  test("a task's own time beats the playbook's, which beats the gig's start", () => {
    const when: PlaybookWhen = { kind: "days", days: -1 };
    expect(due(when, saturday, "12:00")).toBe("2026-12-11 12:00");
    expect(nz(playbookDueAt({ when }, saturday, null).dueAt)).toBe(
      "2026-12-11 21:00",
    );
  });

  test("days count in NZ time, so daylight saving doesn't move the hour", () => {
    // Daylight saving starts on 27 Sep 2026, between these two days.
    const gig = gigOn("2026-10-03");
    const { dueAt } = playbookDueAt(
      { when: { kind: "days", days: -42 } },
      gig,
      null,
    );
    expect(nz(dueAt)).toBe("2026-08-22 21:00");
  });

  test("hours count from doors or the end, else the start", () => {
    const night = {
      startsAt: nzDate("2026-12-12", 21),
      doorsAt: nzDate("2026-12-12", 20),
      endsAt: nzDate("2026-12-13", 3),
    };
    const kit: PlaybookWhen = { kind: "hours", hours: -2, from: "doors" };
    expect(due(kit, night)).toBe("2026-12-12 18:00");
    expect(due(kit, saturday)).toBe("2026-12-12 19:00");
    expect(due({ kind: "hours", hours: 1, from: "end" }, night)).toBe(
      "2026-12-13 04:00",
    );
  });

  test("rules read the way you'd say them", () => {
    expect(
      formatWhen({ kind: "weekday", day: "mon", side: "before", weeks: 0 }),
    ).toBe("Mon before");
    expect(
      formatTaskWhen({
        when: { kind: "weekday", day: "wed", side: "before", weeks: 3 },
        time: "18:00",
      }),
    ).toBe("Wed, 3 weeks before · 6:00 pm");
    expect(formatWhen({ kind: "days", days: -42 })).toBe("6 weeks before");
    expect(formatWhen({ kind: "days", days: -21, weekdays: true })).toBe(
      "3 weeks before · weekdays",
    );
    expect(formatWhen({ kind: "days", days: 1 })).toBe("Day after");
    expect(formatWhen({ kind: "hours", hours: -2, from: "doors" })).toBe(
      "2 hours before doors",
    );
  });
});

describe("moving a task to another day", () => {
  const land = (when: PlaybookWhen) =>
    dayKey(playbookDueAt({ when }, saturday, "17:00").dueAt);

  test("each kind of rule keeps its kind and lands on the new day", () => {
    const rules: PlaybookWhen[] = [
      { kind: "days", days: -7 },
      { kind: "weekday", day: "wed", side: "before", weeks: 0 },
      { kind: "hours", hours: -2, from: "start" },
    ];
    for (const when of rules)
      for (const day of ["2026-11-16", "2026-12-10", "2026-12-16"]) {
        const moved = moveWhen({ when }, day, saturday, "17:00");
        expect(moved.kind).toBe(when.kind);
        expect(land(moved)).toBe(day);
      }
  });

  test("a weekday rule dropped on the gig day becomes a day count", () => {
    expect(
      moveWhen(
        { when: { kind: "weekday", day: "mon", side: "before", weeks: 0 } },
        "2026-12-12",
        saturday,
        "17:00",
      ),
    ).toEqual({ kind: "days", days: 0 });
  });
});

describe("roles", () => {
  const playbook = {
    roles: [
      { name: "lead", userId: "will" },
      { name: "design", userId: null },
    ],
    tasks: [{ role: "design", reviewerRole: "lead" }, { role: "lead" }],
  };

  test("renaming a role renames it on every task that uses it", () => {
    const renamed = renameRole(playbook, "design", "art");
    expect(renamed.roles.map((role) => role.name)).toEqual(["lead", "art"]);
    expect(renamed.tasks[0]).toEqual({ role: "art", reviewerRole: "lead" });
  });

  test("renaming onto another role merges them, without anyone reviewing their own work", () => {
    const merged = renameRole(playbook, "design", "lead");
    expect(merged.roles).toEqual([{ name: "lead", userId: "will" }]);
    expect(merged.tasks[0]).toEqual({ role: "lead", reviewerRole: undefined });
  });

  test("a task's role has to be one of the playbook's roles", () => {
    expect(
      playbookSchema.safeParse({
        roles: [{ name: "lead" }],
        tasks: [
          {
            key: "a",
            title: "A",
            when: { kind: "days", days: -1 },
            role: "promo",
          },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("playbooks saved before date rules", () => {
  test("read as day counts and hours due at the gig's start, landing where they did", () => {
    const stored = [
      {
        key: "poster",
        title: "Poster",
        offsetMinutes: -30 * 1440,
        role: "design",
        reviewerRole: "lead",
        critical: false,
        dependsOn: [],
      },
      {
        key: "kit",
        title: "Door kit",
        offsetMinutes: -360,
        role: "production",
        critical: true,
        dependsOn: ["poster"],
      },
    ];
    const playbook = storedPlaybookSchema.parse(stored);
    expect(playbook.dueTime).toBe(null);
    expect(playbook.roles.map((role) => role.name)).toEqual([
      "design",
      "lead",
      "production",
    ]);
    // Both dates sit in daylight saving, so the old minute counts agree.
    for (const [index, task] of playbook.tasks.entries())
      expect(
        playbookDueAt(task, saturday, playbook.dueTime).dueAt.getTime(),
      ).toBe(
        saturday.startsAt.getTime() + stored[index]!.offsetMinutes * 60_000,
      );
    // Across daylight saving a day count keeps the gig's time of day, where
    // the old minute count landed an hour early.
    expect(
      nz(playbookDueAt(playbook.tasks[0]!, gigOn("2026-10-03"), null).dueAt),
    ).toBe("2026-09-03 21:00");
  });
});

describe("playbook plan", () => {
  const clubNight = STARTER_PLAYBOOKS.find(
    (book) => book.name === "Club night",
  )!;
  const playbook = playbookSchema.parse(clubNight);
  const at = (plan: ReturnType<typeof playbookPlan>, key: string) =>
    plan.find((row) => row.item.key === key)!;

  test("applied in time, every task lands on its own date", () => {
    const plan = playbookPlan(playbook, saturday, nzDate("2026-09-01"));
    for (const row of plan)
      expect(row.projectedAt.getTime()).toBe(row.dueAt.getTime());
  });

  test("applied a week out, work behind a late task gets a day after it, not the whole spacing", () => {
    const plan = playbookPlan(playbook, saturday, nzDate("2026-12-05", 17));
    const lineup = at(plan, "lineup");
    expect(nz(lineup.dueAt)).toBe("2026-11-07 17:00");
    // A day after the late venue, counted from now, rather than its week.
    expect(nz(lineup.projectedAt)).toBe("2026-12-06 17:00");
    // The run sheet waits on the line-up but is due days later, so it stays.
    const runSheet = at(plan, "run-sheet");
    expect(runSheet.projectedAt.getTime()).toBe(runSheet.dueAt.getTime());
    // The venue waits on nothing, so it stays put, just late.
    expect(at(plan, "venue").projectedAt.getTime()).toBe(
      at(plan, "venue").dueAt.getTime(),
    );
  });
});

describe("starter playbooks", () => {
  const nights: Weekday[] = ["thu", "fri", "sat", "sun"];
  for (const book of STARTER_PLAYBOOKS) {
    test(`${book.name} saves, and on a Thursday to Sunday gig nothing waits on a task due later`, () => {
      const playbook = playbookSchema.parse(book);
      for (const night of nights) {
        const gig = sampleGig(night, playbook.tasks, "2026-10-28");
        const at = (key: string) => {
          const task = playbook.tasks.find((task) => task.key === key)!;
          return playbookDueAt(task, gig, playbook.dueTime).dueAt.getTime();
        };
        for (const task of playbook.tasks)
          for (const key of task.dependsOn)
            expect(at(key) <= at(task.key)).toBe(true);
      }
    });
  }
});
