import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { computeOrderTotals, splitCents } from "./money";

describe("splitCents", () => {
  test("shares add back up to the whole, odd cents first", () => {
    assert.deepEqual(splitCents(10_000, 3), [3334, 3333, 3333]);
    assert.deepEqual(splitCents(0, 4), [0, 0, 0, 0]);
  });
});

describe("computeOrderTotals with a group tier", () => {
  test("prices the group once and charges the fixed fee per ticket", () => {
    // Two groups of four at $100 each: $200, and eight tickets' worth of fee.
    const totals = computeOrderTotals({
      lines: [{ unitPriceCents: 10_000, quantity: 2, groupSize: 4 }],
      fee: { fixedCents: 100, percentBp: 0 },
    });
    assert.equal(totals.subtotalCents, 20_000);
    assert.equal(totals.quantity, 8);
    assert.equal(totals.bookingFeeCents, 800);
  });
});
