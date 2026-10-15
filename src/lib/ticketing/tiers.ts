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
  /** Set by `moveUnsoldToDoor` once online sales have closed. */
  moved?: number;
};

/**
 * Tickets still sellable in this tier, ignoring sale windows. Counts tickets
 * moved in or out by `moveUnsoldToDoor`, when the tier has been through it.
 */
export function remainingInTier(tier: {
  allocation: number;
  soldCount: number;
  heldCount: number;
  moved?: number;
}): number {
  return Math.max(
    0,
    tier.allocation + (tier.moved ?? 0) - tier.soldCount - tier.heldCount,
  );
}

/**
 * Once the event's online sales close, every ticket the online-only tiers
 * didn't sell moves to the last door-only tier, so the door can sell the room
 * out at the door price. No allocation changes: `moved` is worked out from
 * the live counts each time, so an online hold that lapses after close moves
 * too, and pushing the close date back moves everything home again.
 *
 * `moved` is tickets in (positive) or out (negative), which `remainingInTier`
 * adds on. With no active door-only tier there is nowhere to go, and nothing
 * moves.
 */
export function moveUnsoldToDoor<
  T extends {
    sortOrder: number;
    salesChannel: TierSalesChannel;
    isActive: boolean;
    allocation: number;
    soldCount: number;
    heldCount: number;
  },
>(
  tiers: readonly T[],
  salesCloseAt: Date | null,
  now: Date,
): (T & { moved: number })[] {
  const closed = salesCloseAt !== null && now > salesCloseAt;
  const door = closed
    ? tiers
        .filter((tier) => tier.salesChannel === "DOOR" && tier.isActive)
        .reduce<T | undefined>(
          (last, tier) =>
            !last || tier.sortOrder >= last.sortOrder ? tier : last,
          undefined,
        )
    : undefined;
  const unsold = (tier: T) =>
    door && tier.salesChannel === "ONLINE" ? remainingInTier(tier) : 0;
  const total = tiers.reduce((sum, tier) => sum + unsold(tier), 0);
  return tiers.map((tier) => ({
    ...tier,
    moved: tier === door ? total : -unsold(tier),
  }));
}

/**
 * Whether the sale of `sold` tickets is the one that sold this tier out.
 *
 * Counts paid tickets only, not holds: a tier with its last seats in somebody's
 * basket is not sold out until they pay, and may never be. Exactly one sale
 * crosses the line, so a tier is reported once per time it sells out.
 */
export function soldOutBy(
  tier: { allocation: number; soldCount: number; groupSize: number },
  sold: number,
): boolean {
  const purchaseLeft = (soldCount: number) =>
    tier.allocation - soldCount >= tier.groupSize;
  return (
    sold > 0 &&
    purchaseLeft(tier.soldCount - sold) &&
    !purchaseLeft(tier.soldCount)
  );
}

/**
 * Face value of what a tier has sold. `soldCount` is in tickets but
 * `priceCents` is per purchase, so a group tier's sales are divided back into
 * groups before they are priced: twelve tickets of a $30 group of four is $90.
 */
export function soldFaceValueCents(tier: {
  soldCount: number;
  priceCents: number;
  groupSize: number;
}): number {
  return Math.floor(tier.soldCount / tier.groupSize) * tier.priceCents;
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
 *
 * `inBasket` is tickets of this tier in the order being checked, which come
 * off what is left: a basket that takes the last three has sold it out.
 */
export function isStillSelling(
  tier: TierRow,
  now: Date,
  inBasket = 0,
): boolean {
  if (!tier.isActive) return false;
  if (tier.salesEndAt && now > tier.salesEndAt) return false;
  return remainingInTier(tier) - inBasket >= tier.groupSize;
}

/**
 * Whether a tier is buyable right now.
 *
 * `tiers` is every tier on the event, which a tier set to release after the
 * previous one needs to find it. `basket` is tickets per tier id in the order
 * being checked, so an order that takes the last of the tier above can buy
 * from this one too. `unlockedHiddenTiers` carries the ids a discount code
 * has revealed. `channel` is where the sale is happening: a
 * door-only tier is never sold online, and the door sells hidden tiers too —
 * hiding is about who can find a tier online, and staff can see everything.
 */
export function tierUnavailableReason(
  tier: TierRow,
  now: Date,
  {
    tiers = [],
    basket = {},
    unlockedHiddenTiers = [],
    channel = "ONLINE",
  }: {
    tiers?: readonly TierRow[];
    basket?: Readonly<Record<string, number>>;
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
    if (previous && isStillSelling(previous, now, basket[previous.id])) {
      return "WAITING_FOR_PREVIOUS";
    }
  }
  if (tier.salesStartAt && now < tier.salesStartAt) return "NOT_ON_SALE_YET";
  if (tier.salesEndAt && now > tier.salesEndAt) return "SALES_CLOSED";
  // A group of four can't be sold into the last three tickets.
  if (remainingInTier(tier) < tier.groupSize) return "SOLD_OUT";
  return null;
}

/** The buyer-facing label for an unavailable tier, shared by web and app checkout. */
export function tierUnavailableLabel(tier: {
  unavailableReason: TierUnavailableReason | null;
  salesStartAt: Date | null;
  waitingFor?: { name: string } | null;
}): string {
  switch (tier.unavailableReason) {
    case "SOLD_OUT":
      return "Sold out";
    case "NOT_ON_SALE_YET":
      return tier.salesStartAt
        ? `On sale ${tier.salesStartAt.toLocaleDateString("en-NZ", {
            day: "numeric",
            month: "short",
          })}`
        : "Not on sale yet";
    case "SALES_CLOSED":
      return "Sales closed";
    case "WAITING_FOR_PREVIOUS":
      return tier.waitingFor
        ? `Opens when ${tier.waitingFor.name} sells out`
        : "Not on sale yet";
    default:
      return "Unavailable";
  }
}

/** A tier on the buyer's list, as much of it as `openTiers` needs. */
type ListedTier = {
  id: string;
  available: boolean;
  /** Set on a tier locked behind the one above. See `toPublicEvent`. */
  waitingFor: { tierId: string; left: number | null } | null;
};

/**
 * The tiers a buyer can pick from, given what they have picked so far: every
 * available tier, plus any locked behind one whose last purchases are all in
 * the basket. Chains, so taking the last of the first and the last of the
 * second opens the third. `quantities` is purchases per tier id. Checkout
 * re-checks the same thing with `tierUnavailableReason`.
 */
export function openTiers(
  tiers: readonly ListedTier[],
  quantities: Readonly<Record<string, number>>,
): Set<string> {
  const byId = new Map(tiers.map((tier) => [tier.id, tier]));
  const isOpen = (tier: ListedTier): boolean => {
    if (tier.available) return true;
    const above = tier.waitingFor && byId.get(tier.waitingFor.tierId);
    if (!above || tier.waitingFor?.left == null) return false;
    return (quantities[above.id] ?? 0) >= tier.waitingFor.left && isOpen(above);
  };
  return new Set(tiers.filter(isOpen).map((tier) => tier.id));
}
