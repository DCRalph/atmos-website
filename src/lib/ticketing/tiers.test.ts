import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import {
  moveUnsoldToDoor,
  openTiers,
  remainingInTier,
  soldFaceValueCents,
  soldOutBy,
  tierUnavailableReason,
  type TierRow,
} from "./tiers";

const now = new Date("2026-10-18T09:00:00Z");

function tier(id: string, sortOrder: number, fields: Partial<TierRow> = {}) {
  return {
    id,
    sortOrder,
    allocation: 50,
    soldCount: 0,
    heldCount: 0,
    groupSize: 1,
    isActive: true,
    isHidden: false,
    releaseAfterPrevious: false,
    salesChannel: "ALL",
    salesStartAt: null,
    salesEndAt: null,
    ...fields,
  } satisfies TierRow;
}

describe("releaseAfterPrevious", () => {
  test("waits while the tier above is still selling", () => {
    const early = tier("early", 0);
    const ga = tier("ga", 1, { releaseAfterPrevious: true });
    const tiers = [early, ga];
    assert.equal(
      tierUnavailableReason(ga, now, { tiers }),
      "WAITING_FOR_PREVIOUS",
    );
  });

  test("opens once the tier above sells out, closes or is switched off", () => {
    const ga = tier("ga", 1, { releaseAfterPrevious: true });
    for (const early of [
      tier("early", 0, { soldCount: 50 }),
      tier("early", 0, { salesEndAt: new Date("2026-10-01T00:00:00Z") }),
      tier("early", 0, { isActive: false }),
    ]) {
      assert.equal(
        tierUnavailableReason(ga, now, { tiers: [early, ga] }),
        null,
      );
    }
  });

  test("a chain of three releases one at a time", () => {
    const first = tier("a", 0, { soldCount: 50 });
    const second = tier("b", 1, { releaseAfterPrevious: true });
    const third = tier("c", 2, { releaseAfterPrevious: true });
    const tiers = [first, second, third];
    assert.equal(tierUnavailableReason(second, now, { tiers }), null);
    assert.equal(
      tierUnavailableReason(third, now, { tiers }),
      "WAITING_FOR_PREVIOUS",
    );
  });

  test("a group tier above with fewer tickets left than a group has sold out", () => {
    const groups = tier("groups", 0, { groupSize: 4, soldCount: 48 });
    const ga = tier("ga", 1, { releaseAfterPrevious: true });
    assert.equal(tierUnavailableReason(ga, now, { tiers: [groups, ga] }), null);
  });
});

describe("releaseAfterPrevious with a basket", () => {
  test("an order that takes the last of the tier above can buy this one", () => {
    const early = tier("early", 0, { soldCount: 47 });
    const ga = tier("ga", 1, { releaseAfterPrevious: true });
    const tiers = [early, ga];
    assert.equal(
      tierUnavailableReason(ga, now, { tiers, basket: { early: 2 } }),
      "WAITING_FOR_PREVIOUS",
    );
    assert.equal(
      tierUnavailableReason(ga, now, { tiers, basket: { early: 3 } }),
      null,
    );
  });

  test("a group tier above opens once no whole group is left", () => {
    const groups = tier("groups", 0, { groupSize: 4, soldCount: 42 });
    const ga = tier("ga", 1, { releaseAfterPrevious: true });
    // 8 left is two groups; taking one leaves another.
    assert.equal(
      tierUnavailableReason(ga, now, {
        tiers: [groups, ga],
        basket: { groups: 4 },
      }),
      "WAITING_FOR_PREVIOUS",
    );
    assert.equal(
      tierUnavailableReason(ga, now, {
        tiers: [groups, ga],
        basket: { groups: 8 },
      }),
      null,
    );
  });
});

describe("openTiers", () => {
  const listed = (
    id: string,
    waitingFor: { tierId: string; left: number | null } | null = null,
  ) => ({ id, available: waitingFor === null, waitingFor });

  test("opens a locked tier once the basket holds the last of the one above", () => {
    const tiers = [listed("early"), listed("ga", { tierId: "early", left: 3 })];
    assert.deepEqual([...openTiers(tiers, { early: 2 })], ["early"]);
    assert.deepEqual([...openTiers(tiers, { early: 3 })], ["early", "ga"]);
  });

  test("chains, and never opens on a count it wasn't given", () => {
    const tiers = [
      listed("a"),
      listed("b", { tierId: "a", left: 2 }),
      listed("c", { tierId: "b", left: 5 }),
      listed("d", { tierId: "c", left: null }),
    ];
    assert.deepEqual([...openTiers(tiers, { b: 5 })], ["a"]);
    assert.deepEqual(
      [...openTiers(tiers, { a: 2, b: 5, c: 50 })],
      ["a", "b", "c"],
    );
  });
});

describe("salesChannel", () => {
  test("a door tier is never sold online, and an online tier never at the door", () => {
    const door = tier("door", 0, { salesChannel: "DOOR" });
    const online = tier("online", 1, { salesChannel: "ONLINE" });
    assert.equal(tierUnavailableReason(door, now), "NOT_SOLD_HERE");
    assert.equal(tierUnavailableReason(door, now, { channel: "DOOR" }), null);
    assert.equal(
      tierUnavailableReason(online, now, { channel: "DOOR" }),
      "NOT_SOLD_HERE",
    );
  });

  test("the door can sell a hidden tier", () => {
    const guests = tier("guests", 0, { isHidden: true });
    assert.equal(tierUnavailableReason(guests, now), "HIDDEN");
    assert.equal(tierUnavailableReason(guests, now, { channel: "DOOR" }), null);
  });
});

describe("moveUnsoldToDoor", () => {
  const closeAt = new Date("2026-10-18T08:00:00Z");
  const tiers = [
    tier("early", 0, { salesChannel: "ONLINE", allocation: 50, soldCount: 50 }),
    tier("ga", 1, { salesChannel: "ONLINE", allocation: 100, soldCount: 60 }),
    tier("both", 2, { allocation: 20, soldCount: 5 }),
    tier("door1", 3, { salesChannel: "DOOR", allocation: 30, soldCount: 30 }),
    tier("door2", 4, { salesChannel: "DOOR", allocation: 30, soldCount: 10 }),
  ];
  const remaining = (moved: ReturnType<typeof moveUnsoldToDoor<TierRow>>) =>
    Object.fromEntries(moved.map((t) => [t.id, remainingInTier(t)]));

  test("moves what online-only tiers didn't sell to the last door tier", () => {
    assert.deepEqual(remaining(moveUnsoldToDoor(tiers, closeAt, now)), {
      early: 0,
      ga: 0,
      both: 15,
      door1: 0,
      door2: 60,
    });
  });

  test("moves nothing before sales close", () => {
    const later = new Date("2026-10-18T10:00:00Z");
    assert.ok(moveUnsoldToDoor(tiers, later, now).every((t) => t.moved === 0));
    assert.ok(moveUnsoldToDoor(tiers, null, now).every((t) => t.moved === 0));
  });

  test("moves nothing without an active door tier", () => {
    const noDoor = tiers.map((t) =>
      t.salesChannel === "DOOR" ? { ...t, isActive: false } : t,
    );
    assert.ok(
      moveUnsoldToDoor(noDoor, closeAt, now).every((t) => t.moved === 0),
    );
  });
});

describe("soldFaceValueCents", () => {
  test("prices a group tier per group, not per ticket", () => {
    assert.equal(
      soldFaceValueCents({ soldCount: 12, priceCents: 3000, groupSize: 4 }),
      9000,
    );
  });
});

describe("soldOutBy", () => {
  test("only the sale that takes the last seat sells the tier out", () => {
    const tier = { allocation: 10, soldCount: 10, groupSize: 1 };
    assert.equal(soldOutBy(tier, 2), true);
    assert.equal(soldOutBy({ ...tier, soldCount: 9 }, 2), false);
    // Refunded back below the line and re-sold: sold out again.
    assert.equal(soldOutBy(tier, 1), true);
  });

  test("a group tier is sold out once a whole group no longer fits", () => {
    const tier = { allocation: 10, soldCount: 8, groupSize: 4 };
    assert.equal(soldOutBy(tier, 4), true);
    assert.equal(soldOutBy({ ...tier, soldCount: 4 }, 4), false);
  });

  test("selling nothing sells nothing out", () => {
    assert.equal(
      soldOutBy({ allocation: 0, soldCount: 0, groupSize: 1 }, 0),
      false,
    );
  });
});
