import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { allocationRefusal, roomForTier, toAllocationBudget } from "./capacity";

/** A 300-cap room with `allocated` on sale and `comps` given away. */
function room(allocated: number, comps = 0, capacity: number | null = 300) {
  return toAllocationBudget({ capacity, allocated, comps });
}

describe("toAllocationBudget", () => {
  test("comps come off what the tiers may sell", () => {
    const budget = room(200, 20);
    assert.equal(budget.allocatable, 280);
    assert.equal(budget.unallocated, 80);
    assert.equal(budget.overAllocatedBy, 0);
  });

  test("an uncapped event binds nothing", () => {
    const budget = room(1000, 50, null);
    assert.equal(budget.allocatable, null);
    assert.equal(budget.unallocated, null);
    assert.equal(budget.overAllocatedBy, 0);
  });

  test("comps issued past the cap put the tiers over", () => {
    // 300 allocated in a 300 room, then 20 comped: 20 of those tickets can no
    // longer be sold, and the panel has to say so.
    const budget = room(300, 20);
    assert.equal(budget.allocatable, 280);
    assert.equal(budget.overAllocatedBy, 20);
    assert.equal(budget.unallocated, 0);
  });
});

describe("roomForTier", () => {
  test("is what the cap leaves once the other tiers have theirs", () => {
    assert.equal(roomForTier(room(250), 100), 150);
  });

  test("is null when there is no cap", () => {
    assert.equal(roomForTier(room(250, 0, null), 100), null);
  });

  test("never goes negative", () => {
    assert.equal(roomForTier(room(400), 50), 0);
  });
});

describe("allocationRefusal", () => {
  test("allows a tier that fits", () => {
    assert.equal(
      allocationRefusal({
        budget: room(200),
        currentAllocation: 50,
        nextAllocation: 100,
      }),
      null,
    );
  });

  test("allows anything when the event is uncapped", () => {
    assert.equal(
      allocationRefusal({
        budget: room(200, 0, null),
        currentAllocation: 0,
        nextAllocation: 5000,
      }),
      null,
    );
  });

  test("refuses a new tier that would break the cap", () => {
    const refusal = allocationRefusal({
      budget: room(250),
      currentAllocation: 0,
      nextAllocation: 100,
    });
    assert.match(refusal ?? "", /350 tickets on sale against a cap of 300/);
    assert.match(refusal ?? "", /at most 50\./);
  });

  test("counts comps against the cap in the refusal", () => {
    const refusal = allocationRefusal({
      budget: room(200, 20),
      currentAllocation: 200,
      nextAllocation: 300,
    });
    assert.match(refusal ?? "", /20 of which have been comped away/);
    assert.match(refusal ?? "", /at most 280\./);
  });

  test("still lets an over-allocated event be trimmed", () => {
    // Comped past the cap: every tier is over, and every tier still has to be
    // editable downward or the event is stuck.
    const budget = room(300, 20);
    assert.equal(
      allocationRefusal({
        budget,
        currentAllocation: 300,
        nextAllocation: 290,
      }),
      null,
    );
  });

  test("still lets an unrelated field be saved on an over-allocated tier", () => {
    const budget = room(300, 20);
    assert.equal(
      allocationRefusal({
        budget,
        currentAllocation: 300,
        nextAllocation: 300,
      }),
      null,
    );
  });

  test("refuses growth that makes an over-allocated event worse", () => {
    const budget = room(300, 20);
    assert.notEqual(
      allocationRefusal({
        budget,
        currentAllocation: 300,
        nextAllocation: 301,
      }),
      null,
    );
  });
});
