import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import {
  soldFaceValueCents,
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

describe("soldFaceValueCents", () => {
  test("prices a group tier per group, not per ticket", () => {
    assert.equal(
      soldFaceValueCents({ soldCount: 12, priceCents: 3000, groupSize: 4 }),
      9000,
    );
  });
});
