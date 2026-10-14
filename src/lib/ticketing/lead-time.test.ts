import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { bucketLeadTime, leadTimeBucket } from "./lead-time";

describe("lead time", () => {
  test("days fall into the right stretch, after doors counting as the day", () => {
    assert.equal(leadTimeBucket(45), "28+");
    assert.equal(leadTimeBucket(28), "28+");
    assert.equal(leadTimeBucket(27), "14-27");
    assert.equal(leadTimeBucket(7), "7-13");
    assert.equal(leadTimeBucket(2), "1-2");
    assert.equal(leadTimeBucket(0), "0");
    assert.equal(leadTimeBucket(-1), "0");
  });

  test("buckets carry the share sold by the end of each, farthest first", () => {
    const rows = bucketLeadTime([
      { days: 30, n: 10 },
      { days: 10, n: 30 },
      { days: 1, n: 40 },
      { days: 0, n: 15 },
      { days: -1, n: 5 },
    ]);
    assert.deepEqual(
      rows.map((row) => [row.key, row.n]),
      [
        ["28+", 10],
        ["14-27", 0],
        ["7-13", 30],
        ["3-6", 0],
        ["1-2", 40],
        ["0", 20],
      ],
    );
    assert.equal(rows[2]!.soldBy, 0.4);
    assert.equal(rows.at(-1)!.soldBy, 1);
  });

  test("nothing sold is all zeros rather than NaN", () => {
    for (const row of bucketLeadTime([])) {
      assert.equal(row.share, 0);
      assert.equal(row.soldBy, 0);
    }
  });
});
