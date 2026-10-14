import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import {
  breakEvenTickets,
  planRevenuePerTicketCents,
  unsoldRevenueCents,
} from "./break-even";

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

  test("prices what's left at its own tier, not the average so far", () => {
    // Early tiers gone, a group tier gone, a dearer tier and the door left.
    const tiers = [
      { priceCents: 1000, allocation: 30, groupSize: 1, soldCount: 30 },
      { priceCents: 1200, allocation: 50, groupSize: 1, soldCount: 1 },
      { priceCents: 3000, allocation: 28, groupSize: 4, soldCount: 28 },
      { priceCents: 2000, allocation: 32, groupSize: 1, soldCount: 0 },
    ];
    const fee = { fixedCents: 0, percentBp: 0 };
    // 49 at $12 and 32 at $20.
    assert.equal(
      unsoldRevenueCents({ tiers, fee, venueFeePerTicket: 0, maxTickets: 81 }),
      122_800,
    );
    // Only 60 fit in the room: the 49 dearer tickets, then 11 at the door.
    assert.equal(
      unsoldRevenueCents({ tiers, fee, venueFeePerTicket: 0, maxTickets: 60 }),
      80_800,
    );
  });
});
