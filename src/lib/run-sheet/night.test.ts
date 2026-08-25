import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import {
  formatTimeOfDay,
  nightsBetween,
  parseTimeOfDay,
  rebaseSchedule,
  resolveNightTime,
  rollsOver,
} from "./night";

/** A Friday night gig, in whatever zone the test runs in. */
const friday = new Date(2026, 2, 13, 21, 0);

describe("typing a time", () => {
  test("takes the shapes people actually type", () => {
    assert.equal(parseTimeOfDay("22:15"), 22 * 60 + 15);
    assert.equal(parseTimeOfDay("2215"), 22 * 60 + 15);
    assert.equal(parseTimeOfDay("9:05"), 9 * 60 + 5);
    assert.equal(parseTimeOfDay(" 01.00 "), 60);
  });

  test("refuses what is not a time", () => {
    assert.equal(parseTimeOfDay(""), null);
    assert.equal(parseTimeOfDay("late"), null);
    assert.equal(parseTimeOfDay("25:00"), null);
    assert.equal(parseTimeOfDay("22:75"), null);
  });

  test("round-trips through the input", () => {
    const at = resolveNightTime(friday, parseTimeOfDay("22:15")!);
    assert.equal(formatTimeOfDay(at), "22:15");
  });
});

describe("a time of night", () => {
  test("an evening time is the gig's own day", () => {
    const doors = resolveNightTime(friday, parseTimeOfDay("20:00")!);
    assert.equal(doors.getDate(), 13);
    assert.equal(rollsOver(friday, doors), false);
  });

  test("a small-hours time is the morning after", () => {
    const curfew = resolveNightTime(friday, parseTimeOfDay("01:00")!);
    assert.equal(curfew.getDate(), 14);
    assert.equal(rollsOver(friday, curfew), true);
  });

  test("a gig recorded as starting after midnight still belongs to the night before", () => {
    const lateStart = new Date(2026, 2, 14, 0, 30);
    const doors = resolveNightTime(lateStart, parseTimeOfDay("22:00")!);
    assert.equal(doors.getDate(), 13);
  });
});

describe("moving the gig", () => {
  const rows = [
    {
      startsAt: resolveNightTime(friday, parseTimeOfDay("20:00")!),
      endsAt: null,
    },
    {
      startsAt: resolveNightTime(friday, parseTimeOfDay("01:00")!),
      endsAt: null,
    },
  ];

  test("takes the run sheet with it, keeping the times of night", () => {
    const saturday = new Date(2026, 2, 14, 21, 0);
    const moved = rebaseSchedule(rows, friday, saturday);
    assert.equal(formatTimeOfDay(moved[0]!.startsAt), "20:00");
    assert.equal(moved[0]!.startsAt.getDate(), 14);
    assert.equal(formatTimeOfDay(moved[1]!.startsAt), "01:00");
    assert.equal(moved[1]!.startsAt.getDate(), 15);
  });

  test("does nothing when only the time of day changed", () => {
    const later = new Date(2026, 2, 13, 23, 0);
    assert.equal(nightsBetween(friday, later), 0);
    const moved = rebaseSchedule(rows, friday, later);
    assert.equal(moved[0]!.startsAt.getDate(), 13);
  });

  test("survives the daylight saving change", () => {
    // New Zealand leaves NZDT on 5 April 2026.
    const before = new Date(2026, 3, 3, 21, 0);
    const after = new Date(2026, 3, 10, 21, 0);
    const [row] = rebaseSchedule(
      [{ startsAt: resolveNightTime(before, 22 * 60), endsAt: null }],
      before,
      after,
    );
    assert.equal(formatTimeOfDay(row!.startsAt), "22:00");
  });
});
