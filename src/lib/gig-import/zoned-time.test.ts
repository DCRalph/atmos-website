import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { dateToZonedWallTime, zonedWallTimeToDate } from "./zoned-time";

/**
 * A gig imported from a caption is stored as an instant, and the caption only
 * ever gives a wall time. Auckland is UTC+13 over summer and UTC+12 over
 * winter, so getting this wrong shifts a whole line-up by an hour for half the
 * year, silently.
 */

const auckland = "Pacific/Auckland";

describe("zonedWallTimeToDate", () => {
  test("reads a summer night at UTC+13", () => {
    assert.equal(
      zonedWallTimeToDate("2026-10-23T22:00", auckland)?.toISOString(),
      "2026-10-23T09:00:00.000Z",
    );
  });

  test("reads a winter night at UTC+12", () => {
    assert.equal(
      zonedWallTimeToDate("2026-06-19T22:00", auckland)?.toISOString(),
      "2026-06-19T10:00:00.000Z",
    );
  });

  test("a 2am finish is the following morning, not the same one", () => {
    assert.equal(
      zonedWallTimeToDate("2026-10-24T02:00", auckland)?.toISOString(),
      "2026-10-23T13:00:00.000Z",
    );
  });

  test("survives the night the clocks go forward", () => {
    // Daylight saving starts 2026-09-27 at 2am, when clocks jump to 3am. A gig
    // that began at 11pm the evening before is still UTC+12 at that point.
    assert.equal(
      zonedWallTimeToDate("2026-09-26T23:00", auckland)?.toISOString(),
      "2026-09-26T11:00:00.000Z",
    );
    // And the same night's 4am finish is already UTC+13.
    assert.equal(
      zonedWallTimeToDate("2026-09-27T04:00", auckland)?.toISOString(),
      "2026-09-26T15:00:00.000Z",
    );
  });

  test("refuses anything that is not a bare wall time", () => {
    assert.equal(zonedWallTimeToDate("2026-10-23", auckland), null);
    assert.equal(zonedWallTimeToDate("Friday 23 October", auckland), null);
    assert.equal(zonedWallTimeToDate("2026-10-23T22:00:00Z", auckland), null);
  });
});

describe("dateToZonedWallTime", () => {
  test("round trips both sides of a daylight saving change", () => {
    for (const wall of ["2026-10-23T22:00", "2026-06-19T22:00"]) {
      const instant = zonedWallTimeToDate(wall, auckland);
      assert.ok(instant);
      assert.equal(dateToZonedWallTime(instant, auckland), wall);
    }
  });
});
