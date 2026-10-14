import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { firstReleaseShare, pricePoints } from "./price-points";

const tier = (
  priceCents: number,
  allocation: number,
  soldCount: number,
  extra: Partial<{ groupSize: number; sortOrder: number }> = {},
) => ({
  priceCents,
  allocation,
  soldCount,
  groupSize: extra.groupSize ?? 1,
  sortOrder: extra.sortOrder ?? 0,
});

describe("price points", () => {
  test("groups tiers by the price of one ticket, cheapest first", () => {
    const points = pricePoints([
      tier(2000, 50, 50),
      tier(1000, 30, 30),
      // A group of four at $40 is $10 a ticket, so it joins the $10 row.
      tier(4000, 28, 28, { groupSize: 4 }),
      tier(2000, 50, 10),
    ]);
    assert.deepEqual(
      points.map((point) => [
        point.priceCents,
        point.tiers,
        point.sold,
        point.allocation,
        point.revenueCents,
      ]),
      [
        [1000, 2, 58, 58, 58000],
        [2000, 2, 60, 100, 120000],
      ],
    );
    assert.equal(points[1]!.sellThrough, 0.6);
  });

  test("the first paid tier's share, only where there was a second", () => {
    const share = firstReleaseShare([
      // Free tier ignored; first release took 30 of 40 paid.
      {
        tiers: [
          tier(0, 80, 3),
          tier(1000, 30, 30, { sortOrder: 1 }),
          tier(1200, 50, 10, { sortOrder: 2 }),
        ],
      },
      // One paid tier: tells you nothing, so left out.
      { tiers: [tier(3000, 250, 100)] },
      // Nothing sold yet: left out.
      { tiers: [tier(1000, 10, 0), tier(2000, 10, 0, { sortOrder: 1 })] },
    ]);
    assert.deepEqual(share, { events: 1, sold: 30, total: 40, share: 0.75 });
  });

  test("no qualifying event is a null share", () => {
    assert.equal(firstReleaseShare([]).share, null);
  });
});
