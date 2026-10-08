import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import {
  computeOrderTotals,
  splitCents,
  venueFeePerTicketCents,
} from "./money";

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

describe("venue fee", () => {
  test("splits the hire across the cap, rounding up", () => {
    const event = { venueHireCents: 100_000, capacity: 300 };
    assert.equal(
      venueFeePerTicketCents({ ...event, passVenueHire: true }),
      334,
    );
    assert.equal(venueFeePerTicketCents({ ...event, passVenueHire: false }), 0);
    assert.equal(
      venueFeePerTicketCents({ ...event, capacity: null, passVenueHire: true }),
      0,
    );
  });

  test("is per ticket, outside the percentage, and skipped when free", () => {
    const totals = computeOrderTotals({
      lines: [{ unitPriceCents: 2500, quantity: 2, groupSize: 1 }],
      fee: { fixedCents: 0, percentBp: 1000 },
      venueFeePerTicket: 800,
    });
    assert.equal(totals.venueFeeCents, 1600);
    assert.equal(totals.bookingFeeCents, 500);
    assert.equal(totals.totalCents, 7100);

    const free = computeOrderTotals({
      lines: [{ unitPriceCents: 2500, quantity: 2, groupSize: 1 }],
      discountCents: 5000,
      venueFeePerTicket: 800,
    });
    assert.equal(free.venueFeeCents, 0);
    assert.equal(free.totalCents, 0);
  });
});
