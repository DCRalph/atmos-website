/**
 * Whether a tier can be bought, as one rule for the checkout, the public page,
 * the door and the admin tier list.
 *
 * Client-safe: the admin tier editor shows "waiting for Early bird" from the
 * same arithmetic the checkout enforces.
 */

/** Why a tier cannot currently be bought. `null` means it can. */
export type TierUnavailableReason =
  | "SOLD_OUT"
  | "NOT_ON_SALE_YET"
  | "SALES_CLOSED"
  | "DISABLED"
  | "HIDDEN"
  | "WAITING_FOR_PREVIOUS"
  | "NOT_SOLD_HERE";

/** Where a tier is sold. Mirrors the `TierSalesChannel` enum. */
export type TierSalesChannel = "ALL" | "ONLINE" | "DOOR";

/** Where a sale is happening: the website and app, or a staff member at the door. */
export type SaleChannel = "ONLINE" | "DOOR";

/** Whether a tier is sold through this channel at all. */
export function soldThrough(
  tier: { salesChannel: TierSalesChannel },
  channel: SaleChannel,
): boolean {
  return tier.salesChannel === "ALL" || tier.salesChannel === channel;
}

export type TierRow = {
  id: string;
  sortOrder: number;
  allocation: number;
  soldCount: number;
  heldCount: number;
  groupSize: number;
  isActive: boolean;
  isHidden: boolean;
  releaseAfterPrevious: boolean;
  salesChannel: TierSalesChannel;
  salesStartAt: Date | null;
  salesEndAt: Date | null;
};

/** Tickets still sellable in this tier, ignoring sale windows. */
export function remainingInTier(tier: {
  allocation: number;
  soldCount: number;
  heldCount: number;
}): number {
  return Math.max(0, tier.allocation - tier.soldCount - tier.heldCount);
}

/** The tier listed directly above this one, or null for the first. */
export function previousTier<T extends { id: string; sortOrder: number }>(
  tiers: readonly T[],
  tier: T,
): T | null {
  const ordered = [...tiers].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
  );
  const index = ordered.findIndex((t) => t.id === tier.id);
  return index > 0 ? (ordered[index - 1] ?? null) : null;
}

/**
 * Whether a tier still has selling to do, now or later: switched on, not past
 * its sale end, and with at least one purchase left. Hidden tiers count — they
 * sell to whoever holds the code — and so does a tier still waiting its own
 * turn, which is what lets a chain of three release one at a time.
 */
export function isStillSelling(tier: TierRow, now: Date): boolean {
  if (!tier.isActive) return false;
  if (tier.salesEndAt && now > tier.salesEndAt) return false;
  return remainingInTier(tier) >= tier.groupSize;
}

/**
 * Whether a tier is buyable right now.
 *
 * `tiers` is every tier on the event, which a tier set to release after the
 * previous one needs to find it. `unlockedHiddenTiers` carries the ids a
 * discount code has revealed. `channel` is where the sale is happening: a
 * door-only tier is never sold online, and the door sells hidden tiers too —
 * hiding is about who can find a tier online, and staff can see everything.
 */
export function tierUnavailableReason(
  tier: TierRow,
  now: Date,
  {
    tiers = [],
    unlockedHiddenTiers = [],
    channel = "ONLINE",
  }: {
    tiers?: readonly TierRow[];
    unlockedHiddenTiers?: readonly string[];
    channel?: SaleChannel;
  } = {},
): TierUnavailableReason | null {
  if (!soldThrough(tier, channel)) return "NOT_SOLD_HERE";
  if (
    channel === "ONLINE" &&
    tier.isHidden &&
    !unlockedHiddenTiers.includes(tier.id)
  ) {
    return "HIDDEN";
  }
  if (!tier.isActive) return "DISABLED";
  if (tier.releaseAfterPrevious) {
    const previous = previousTier(tiers, tier);
    if (previous && isStillSelling(previous, now)) {
      return "WAITING_FOR_PREVIOUS";
    }
  }
  if (tier.salesStartAt && now < tier.salesStartAt) return "NOT_ON_SALE_YET";
  if (tier.salesEndAt && now > tier.salesEndAt) return "SALES_CLOSED";
  // A group of four can't be sold into the last three tickets.
  if (remainingInTier(tier) < tier.groupSize) return "SOLD_OUT";
  return null;
}
