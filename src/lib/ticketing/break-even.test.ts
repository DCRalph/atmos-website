import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { breakEvenTickets, planRevenuePerTicketCents } from "./break-even";

describe("break even", () => {
  test("a ticket carries its price and both fees", () => {
    const perTicket = planRevenuePerTicketCents({
      tiers: [{ priceCents: 2500, allocation: 280, groupSize: 1 }],
      fee: { fixedCents: 150, percentBp: 0 },
      venueFeePerTicket: 800,
    });
    assert.equal(perTicket, 3450);
    // $5,070 of costs at $34.50 a ticket.
    assert.equal(breakEvenTickets(507_000, perTicket), 147);
  });

  test("weights by allocation and splits group prices per ticket", () => {
    const perTicket = planRevenuePerTicketCents({
      tiers: [
        { priceCents: 2000, allocation: 100, groupSize: 1 },
        // $100 for four: $25 a ticket.
        { priceCents: 10_000, allocation: 100, groupSize: 4 },
      ],
      fee: { fixedCents: 0, percentBp: 0 },
      venueFeePerTicket: 0,
    });
    assert.equal(perTicket, 2250);
  });

  test("no costs needs nothing, free tickets never get there", () => {
    assert.equal(breakEvenTickets(0, 2500), 0);
    assert.equal(breakEvenTickets(10_000, 0), null);
  });
});
