import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import {
  activityMoments,
  LEAD_IN_MINUTES,
  momentsDue,
  runSheetActivity,
  TAIL_MINUTES,
  type LiveRow,
} from "./live-activity";

const at = (hour: number, minute = 0, second = 0) =>
  new Date(2026, 2, 13, hour, minute, second);

/** A normal night: a sound check, doors, two sets and a curfew. */
const night: LiveRow[] = [
  { name: "Sound check", startsAt: at(17), endsAt: at(18) },
  { name: "Doors", startsAt: at(20), endsAt: null },
  { name: "Kessler", startsAt: at(21), endsAt: null },
  { name: "Nova b2b Juno", startsAt: at(22, 30), endsAt: null },
  { name: "Curfew", startsAt: at(1 + 24), endsAt: null },
];

const gig = { id: "gig_1", title: "Basement", rows: night };

describe("what the lock screen shows", () => {
  test("nothing at all until an hour before the first item", () => {
    assert.equal(runSheetActivity(gig, at(15, 59)), null);
    assert.notEqual(runSheetActivity(gig, at(16, 1)), null);
  });

  test("an hour out it is a countdown to the first item and nothing else", () => {
    const state = runSheetActivity(gig, at(16, 30));
    assert.equal(state?.current, null);
    assert.equal(state?.next?.name, "Sound check");
    assert.deepEqual(state?.next?.startsAt, at(17));
  });

  test("a running item carries the span its progress bar is drawn from", () => {
    const state = runSheetActivity(gig, at(21, 30));
    assert.equal(state?.current?.name, "Kessler");
    assert.deepEqual(state?.current?.startsAt, at(21));
    // No end was typed, so Kessler runs until Nova is on.
    assert.deepEqual(state?.current?.endsAt, at(22, 30));
    assert.equal(state?.next?.name, "Nova b2b Juno");
  });

  test("a typed end wins over the next item's start", () => {
    const state = runSheetActivity(gig, at(17, 30));
    assert.deepEqual(state?.current?.endsAt, at(18));
  });

  test("a gap between a typed end and the next start shows what is next", () => {
    const state = runSheetActivity(gig, at(19));
    assert.equal(state?.current, null);
    assert.equal(state?.next?.name, "Doors");
  });

  test("the last item has nothing after it to run until, so it gets a tail", () => {
    const running = runSheetActivity(gig, at(1 + 24, TAIL_MINUTES - 1));
    assert.equal(running?.current?.name, "Curfew");
    assert.equal(running?.next, null);
  });

  test("the activity is over when the last item is", () => {
    assert.equal(runSheetActivity(gig, at(1 + 24, TAIL_MINUTES + 1)), null);
  });

  test("the night's own span is the first item to the last", () => {
    const state = runSheetActivity(gig, at(21, 30));
    assert.deepEqual(state?.show.startsAt, at(17));
    // Curfew has no end typed and nothing after it, so it gets the tail.
    assert.deepEqual(state?.show.endsAt, at(1 + 24, TAIL_MINUTES));
  });

  test("the night's span does not move as the night runs", () => {
    const early = runSheetActivity(gig, at(16, 30));
    const late = runSheetActivity(gig, at(23));
    assert.deepEqual(early?.show, late?.show);
  });

  test("a run sheet with no times has no activity", () => {
    assert.equal(
      runSheetActivity({ ...gig, rows: [] }, at(21)),
      null,
    );
  });
});

describe("when a phone needs waking", () => {
  const moments = activityMoments(night);

  test("the lead-in is watched, or the activity would never appear", () => {
    assert.deepEqual(
      moments[0],
      new Date(at(17).getTime() - LEAD_IN_MINUTES * 60_000),
    );
  });

  test("every start and every end, and each of them once", () => {
    const ms = moments.map((moment) => moment.getTime());
    assert.equal(new Set(ms).size, ms.length);
    for (const row of night) {
      assert.ok(ms.includes(row.startsAt.getTime()), row.name);
    }
    // 18:00 is a typed end that is nobody's start, so it is its own moment.
    assert.ok(ms.includes(at(18).getTime()));
  });

  test("a moment is due for one sweep only", () => {
    assert.equal(momentsDue(moments, at(21)).length, 1);
    assert.equal(momentsDue(moments, at(21, 1)).length, 0);
    assert.equal(momentsDue(moments, at(20, 59, 40)).length, 1);
  });

  test("a quiet minute wakes nobody", () => {
    assert.deepEqual(momentsDue(moments, at(21, 30)), []);
  });
});
