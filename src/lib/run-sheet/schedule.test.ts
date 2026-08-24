import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import {
  classifyCues,
  cuesFor,
  shiftSchedule,
  sortSchedule,
  type ScheduleRow,
} from "./schedule";

/** NZDT, so the formatted times in the copy below are the local ones. */
const at = (hhmm: string) => new Date(`2026-03-14T${hhmm}:00+13:00`);

function row(over: Partial<ScheduleRow> & { id: string }): ScheduleRow {
  return {
    kind: "SET",
    label: null,
    role: null,
    startsAt: null,
    endsAt: null,
    sortOrder: 0,
    leadMinutes: [5],
    creatorProfile: null,
    ...over,
  };
}

const artist = (id: string, name: string, startsAt: Date, sortOrder: number) =>
  row({
    id,
    startsAt,
    sortOrder,
    creatorProfile: { displayName: name },
  });

const cues = (rows: ScheduleRow[]) => cuesFor(rows, { gigTitle: "Neon Church" });

describe("ordering", () => {
  test("times win over the manual order", () => {
    const ordered = sortSchedule([
      artist("b", "Kessler", at("23:30"), 0),
      artist("a", "Nova", at("22:00"), 1),
    ]);
    assert.deepEqual(
      ordered.map((r) => r.id),
      ["a", "b"],
    );
  });

  test("a line-up with no times keeps the order it was dragged into", () => {
    const ordered = sortSchedule([
      row({ id: "c", sortOrder: 2 }),
      row({ id: "a", sortOrder: 0 }),
      row({ id: "b", sortOrder: 1 }),
    ]);
    assert.deepEqual(
      ordered.map((r) => r.id),
      ["a", "b", "c"],
    );
  });

  test("untimed rows sit after timed ones", () => {
    const ordered = sortSchedule([
      row({ id: "untimed", sortOrder: 0 }),
      artist("timed", "Nova", at("22:00"), 9),
    ]);
    assert.deepEqual(
      ordered.map((r) => r.id),
      ["timed", "untimed"],
    );
  });
});

describe("cues", () => {
  test("a line-up with no times announces nothing", () => {
    assert.deepEqual(cues([row({ id: "a" }), row({ id: "b" })]), []);
  });

  test("the first set of the night is not a changeover", () => {
    const [lead, now] = order(cues([artist("a", "Nova", at("22:00"), 0)]));
    assert.equal(lead?.title, "Nova on in 5 min");
    assert.equal(lead?.body, "10:00 pm. Neon Church.");
    assert.equal(now?.title, "Nova on now");
  });

  test("a set behind another set is a changeover, named both ways", () => {
    const all = cues([
      artist("a", "Nova", at("22:00"), 0),
      artist("b", "Kessler", at("23:30"), 1),
    ]);
    const forB = order(all.filter((cue) => cue.itemId === "b"));
    assert.equal(forB[0]?.title, "Changeover in 5 min");
    assert.equal(forB[0]?.body, "Nova off, Kessler on at 11:30 pm. Neon Church.");
    assert.equal(forB[1]?.title, "Changeover: Kessler on");
    assert.equal(forB[1]?.body, "Nova off, Kessler on. Neon Church.");
  });

  test("a cue is due its lead before the thing itself", () => {
    const [lead] = order(cues([artist("a", "Nova", at("22:00"), 0)]));
    assert.equal(lead?.dueAt.toISOString(), at("21:55").toISOString());
    assert.equal(lead?.firedFor.toISOString(), at("22:00").toISOString());
  });

  test("doors read as doors, and a labelled door reads as itself", () => {
    const plain = cues([
      row({ id: "d", kind: "DOORS", startsAt: at("20:00"), leadMinutes: [15] }),
    ]);
    assert.equal(order(plain)[0]?.title, "Doors in 15 min");
    assert.equal(order(plain)[1]?.title, "Doors open");

    const side = cues([
      row({
        id: "d",
        kind: "DOORS",
        label: "Side door",
        startsAt: at("20:00"),
        leadMinutes: [15],
      }),
    ]);
    assert.equal(order(side)[0]?.title, "Side door in 15 min");
    assert.equal(order(side)[1]?.title, "Side door now");
  });

  test("every row still gets the on-the-cue send with no leads set", () => {
    const only = cues([
      { ...artist("a", "Nova", at("22:00"), 0), leadMinutes: [] },
    ]);
    assert.equal(only.length, 1);
    assert.equal(only[0]?.offsetMinutes, 0);
  });

  test("a duplicated or zero lead does not send twice", () => {
    const dupes = cues([
      { ...artist("a", "Nova", at("22:00"), 0), leadMinutes: [5, 5, 0, -5] },
    ]);
    assert.deepEqual(
      dupes.map((cue) => cue.offsetMinutes).sort((x, y) => x - y),
      [0, 5],
    );
  });
});

describe("the sweep window", () => {
  const all = cues([artist("a", "Nova", at("22:00"), 0)]);

  test("nothing fires early", () => {
    assert.deepEqual(classifyCues(all, at("21:00")), { due: [], stale: [] });
  });

  test("a cue fires in the minute it comes due", () => {
    const { due, stale } = classifyCues(all, at("21:55"));
    assert.equal(due.length, 1);
    assert.equal(due[0]?.offsetMinutes, 5);
    assert.equal(stale.length, 0);
  });

  test("a late sweep still catches a cue inside the catch-up window", () => {
    const { due } = classifyCues(all, at("21:58"));
    assert.equal(due.length, 1);
  });

  test("a scheduler that was down all night writes cues off rather than firing them at once", () => {
    const fourHoursLater = new Date(at("22:00").getTime() + 4 * 60 * 60_000);
    const { due, stale } = classifyCues(all, fourHoursLater);
    assert.equal(due.length, 0);
    assert.equal(stale.length, 2);
  });
});

describe("running late", () => {
  const rows = [
    { id: "a", startsAt: at("22:00"), endsAt: at("23:00") },
    { id: "b", startsAt: at("23:00"), endsAt: null },
    { id: "c", startsAt: null, endsAt: null },
  ];

  test("shifts what has not fired and leaves what has", () => {
    const shifted = shiftSchedule(rows, 20, new Set(["a"]));
    assert.equal(shifted[0]?.startsAt?.toISOString(), at("22:00").toISOString());
    assert.equal(shifted[1]?.startsAt?.toISOString(), at("23:20").toISOString());
  });

  test("a row with no time stays a row with no time", () => {
    const shifted = shiftSchedule(rows, 20, new Set());
    assert.equal(shifted[2]?.startsAt, null);
  });
});

/** Cues for one item, earliest lead first. */
function order<T extends { offsetMinutes: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => b.offsetMinutes - a.offsetMinutes);
}
