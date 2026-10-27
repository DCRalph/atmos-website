import { describe, expect, test } from "bun:test";
import { playbookSchema } from "./input";
import {
  formatOffset,
  playbookPhase,
  playbookPlan,
  playbookSpan,
} from "./playbooks";
import { STARTER_PLAYBOOKS } from "./starter-playbooks";

const day = 1440;

describe("playbook phases", () => {
  test("a task lands in the week it is due, then gig week, gig day and after", () => {
    expect(playbookPhase(-42 * day)).toBe("6 weeks out");
    expect(playbookPhase(-7 * day)).toBe("1 week out");
    expect(playbookPhase(-6 * day)).toBe("Gig week");
    expect(playbookPhase(-360)).toBe("Gig day");
    expect(playbookPhase(0)).toBe("Gig day");
    expect(playbookPhase(day)).toBe("After the gig");
  });

  test("offsets read as days, or hours when they are not whole days", () => {
    expect(formatOffset(-30 * day)).toBe("30 days before");
    expect(formatOffset(day)).toBe("1 day after");
    expect(formatOffset(-360)).toBe("6 hours before");
    expect(formatOffset(0)).toBe("On the day");
    expect(
      playbookSpan([{ offsetMinutes: 3 * day }, { offsetMinutes: -42 * day }]),
    ).toBe("42 days before to 3 days after");
  });
});

describe("playbook plan", () => {
  const clubNight = STARTER_PLAYBOOKS.find(
    (book) => book.name === "Club night",
  )!;
  const gig = new Date("2026-11-14T08:00:00Z");
  const at = (plan: ReturnType<typeof playbookPlan>, key: string) =>
    plan.find((row) => row.item.key === key)!;

  test("applied in time, every task lands on its own date", () => {
    const plan = playbookPlan(
      clubNight.items,
      gig,
      new Date("2026-09-01T00:00:00Z"),
    );
    for (const row of plan)
      expect(row.projectedAt.getTime()).toBe(row.dueAt.getTime());
  });

  test("applied a week out, work behind a late task moves to where the schedule puts it", () => {
    const now = new Date(gig.getTime() - 7 * day * 60_000);
    const plan = playbookPlan(clubNight.items, gig, now);
    const lineup = at(plan, "lineup");
    expect(lineup.dueAt.getTime()).toBe(gig.getTime() - 35 * day * 60_000);
    // It keeps its week after the venue, counted from now: gig day.
    expect(lineup.projectedAt.getTime()).toBe(gig.getTime());
    // The venue waits on nothing, so it stays put, just late.
    expect(at(plan, "venue").projectedAt.getTime()).toBe(
      at(plan, "venue").dueAt.getTime(),
    );
  });
});

describe("starter playbooks", () => {
  for (const book of STARTER_PLAYBOOKS) {
    test(`${book.name} saves, and nothing in it waits on a task due later`, () => {
      const items = playbookSchema.parse(book.items);
      const byKey = new Map(items.map((item) => [item.key, item]));
      for (const item of items)
        for (const key of item.dependsOn)
          expect(byKey.get(key)!.offsetMinutes <= item.offsetMinutes).toBe(
            true,
          );
    });
  }
});
