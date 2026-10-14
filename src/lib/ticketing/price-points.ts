import { soldFaceValueCents } from "./tiers";

/**
 * Prices across events: how well each price point sells, and how much of an
 * event its first release takes. Pure, over the tier rows the analytics page
 * already has.
 */

export type PricedTier = {
  priceCents: number;
  groupSize: number;
  allocation: number;
  soldCount: number;
  sortOrder: number;
};

/** The price of one ticket, which for a group tier is the group's share. */
const perTicketCents = (tier: PricedTier) =>
  Math.round(tier.priceCents / Math.max(1, tier.groupSize));

export type PricePoint = {
  priceCents: number;
  tiers: number;
  allocation: number;
  sold: number;
  revenueCents: number;
  /** Sold over allocation, 0 to 1. */
  sellThrough: number;
};

/** Sell-through at each price a ticket has been offered at, cheapest first. */
export function pricePoints(tiers: PricedTier[]): PricePoint[] {
  const byPrice = new Map<number, PricePoint>();
  for (const tier of tiers) {
    const priceCents = perTicketCents(tier);
    const point = byPrice.get(priceCents) ?? {
      priceCents,
      tiers: 0,
      allocation: 0,
      sold: 0,
      revenueCents: 0,
      sellThrough: 0,
    };
    point.tiers += 1;
    point.allocation += tier.allocation;
    point.sold += tier.soldCount;
    point.revenueCents += soldFaceValueCents(tier);
    byPrice.set(priceCents, point);
  }
  return [...byPrice.values()]
    .map((point) => ({
      ...point,
      sellThrough: point.allocation > 0 ? point.sold / point.allocation : 0,
    }))
    .sort((a, b) => a.priceCents - b.priceCents);
}

/**
 * The first paid tier's share of an event's paid tickets, across events. Only
 * events that offered more than one paid tier count: with one, the share is
 * always everything. Null when no event qualifies.
 */
export function firstReleaseShare(events: { tiers: PricedTier[] }[]): {
  events: number;
  sold: number;
  total: number;
  share: number | null;
} {
  let counted = 0;
  let sold = 0;
  let total = 0;
  for (const event of events) {
    const paid = event.tiers
      .filter((tier) => tier.priceCents > 0)
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder || perTicketCents(a) - perTicketCents(b),
      );
    const eventTotal = paid.reduce((sum, tier) => sum + tier.soldCount, 0);
    if (paid.length < 2 || eventTotal === 0) continue;
    counted += 1;
    sold += paid[0]!.soldCount;
    total += eventTotal;
  }
  return {
    events: counted,
    sold,
    total,
    share: total > 0 ? sold / total : null,
  };
}
