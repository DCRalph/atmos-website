import { describe, test } from "bun:test";
import assert from "node:assert/strict";
import { doorTotalsSchema, sumDoorTotals } from "./door-totals";

const tally = {
  cashTickets: 12,
  cashCents: 42_000,
  eftposTickets: 18,
  eftposCents: 63_000,
  notes: "Final cash count and external terminal report",
};

describe("off-platform door totals", () => {
  test("accepts actual takings independently of a ticket tier's price", () => {
    assert.deepEqual(sumDoorTotals(doorTotalsSchema.parse(tally)), {
      tickets: 30,
      revenueCents: 105_000,
    });
    assert.deepEqual(sumDoorTotals(null), { tickets: 0, revenueCents: 0 });
  });

  test("allows a zero tally to clear a mistaken entry and zero-price admissions", () => {
    assert(
      doorTotalsSchema.safeParse({
        ...tally,
        cashTickets: 0,
        cashCents: 0,
        eftposTickets: 0,
        eftposCents: 0,
      }).success,
    );
    assert(doorTotalsSchema.safeParse({ ...tally, cashCents: 0 }).success);
  });

  test("requires a ticket count for each payment method with takings", () => {
    for (const method of ["cash", "eftpos"] as const) {
      const result = doorTotalsSchema.safeParse({
        ...tally,
        [`${method}Tickets`]: 0,
      });
      assert(!result.success);
      assert.deepEqual(result.error.issues[0]?.path, [`${method}Tickets`]);
    }
  });

  test("rejects negative, fractional, invalid and out-of-range amounts and counts", () => {
    for (const field of [
      "cashTickets",
      "eftposTickets",
      "cashCents",
      "eftposCents",
    ] as const) {
      for (const value of [-1, 0.5, NaN, Infinity, 2_147_483_648]) {
        assert(
          !doorTotalsSchema.safeParse({ ...tally, [field]: value }).success,
          `${field}: ${value}`,
        );
      }
    }
    assert(
      !doorTotalsSchema.safeParse({ ...tally, notes: "a".repeat(501) }).success,
    );
  });
});
