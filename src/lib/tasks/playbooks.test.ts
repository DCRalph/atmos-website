import { describe, expect, test } from "bun:test";
import { playbookSchema } from "./input";
import { formatOffset, playbookPhase, playbookSpan } from "./playbooks";
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
