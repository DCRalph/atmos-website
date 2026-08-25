import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import {
  clockOptions,
  formatClock,
  minutesOfDay,
  nightsBetween,
  parseClock,
  parseTimeOfDay,
  rebaseSchedule,
  resolveNightTime,
  rollsOver,
} from "./night";

const clockOf = (at: Date) => formatClock(minutesOfDay(at));

/** A Friday night gig, in whatever zone the test runs in. */
const friday = new Date(2026, 2, 13, 21, 0);

describe("typing a time", () => {
  test("takes 24-hour, however it is punctuated", () => {
    assert.equal(parseTimeOfDay("22:15"), 22 * 60 + 15);
    assert.equal(parseTimeOfDay("2215"), 22 * 60 + 15);
    assert.equal(parseTimeOfDay("22.15"), 22 * 60 + 15);
  });

  test("an explicit meridiem settles it", () => {
    assert.deepEqual(parseClock("9pm"), [21 * 60]);
    assert.deepEqual(parseClock("9 PM"), [21 * 60]);
    assert.deepEqual(parseClock("9:30pm"), [21 * 60 + 30]);
    assert.deepEqual(parseClock("930 p"), [21 * 60 + 30]);
    assert.deepEqual(parseClock("9am"), [9 * 60]);
    assert.deepEqual(parseClock("12am"), [0]);
    assert.deepEqual(parseClock("12pm"), [12 * 60]);
  });

  test("a leading zero means somebody is typing 24-hour time", () => {
    assert.deepEqual(parseClock("01.00"), [60]);
    assert.deepEqual(parseClock("0930"), [9 * 60 + 30]);
  });

  test("a bare hour offers the evening first, and the morning second", () => {
    assert.deepEqual(parseClock("9"), [21 * 60, 9 * 60]);
    assert.deepEqual(parseClock("9:30"), [21 * 60 + 30, 9 * 60 + 30]);
    assert.deepEqual(parseClock("1"), [13 * 60, 60]);
    assert.deepEqual(parseClock("12"), [12 * 60, 0]);
  });

  test("refuses what is not a time", () => {
    assert.deepEqual(parseClock(""), []);
    assert.deepEqual(parseClock("late"), []);
    assert.deepEqual(parseClock("25:00"), []);
    assert.deepEqual(parseClock("22:75"), []);
    assert.deepEqual(parseClock("13pm"), []);
    assert.deepEqual(parseClock("0am"), []);
  });

  test("takes the words for the two times that have them", () => {
    assert.deepEqual(parseClock("noon"), [12 * 60]);
    assert.deepEqual(parseClock("midnight"), [0]);
  });

  test("round-trips through the field", () => {
    const at = resolveNightTime(friday, parseTimeOfDay("22:15")!);
    assert.equal(clockOf(at), "10:15 pm");
  });
});

describe("writing a time", () => {
  test("reads as a clock, not as a timestamp", () => {
    assert.equal(formatClock(0), "12:00 am");
    assert.equal(formatClock(12 * 60), "12:00 pm");
    assert.equal(formatClock(9 * 60 + 5), "9:05 am");
    assert.equal(formatClock(21 * 60 + 30), "9:30 pm");
    assert.equal(formatClock(23 * 60 + 59), "11:59 pm");
  });

  test("the list behind the field covers the whole clock", () => {
    const options = clockOptions(15);
    assert.equal(options.length, 96);
    assert.equal(formatClock(options[0]!), "12:00 am");
    assert.equal(formatClock(options.at(-1)!), "11:45 pm");
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
    assert.equal(clockOf(moved[0]!.startsAt), "8:00 pm");
    assert.equal(moved[0]!.startsAt.getDate(), 14);
    assert.equal(clockOf(moved[1]!.startsAt), "1:00 am");
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
    assert.equal(clockOf(row!.startsAt), "10:00 pm");
  });
});
