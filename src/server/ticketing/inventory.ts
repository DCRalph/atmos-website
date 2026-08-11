import "server-only";

import { type Prisma, TicketOrderStatus, TicketStatus } from "~Prisma/client";

import { db } from "~/server/db";

/**
 * Inventory: the one place that decides whether a ticket can be sold.
 *
 * `TicketTier.soldCount` and `heldCount` are denormalised so the public buy
 * panel can render remaining counts without aggregating the ticket table on
 * every page view. Correctness comes from doing every mutation inside
 * `withEventInventoryLock`, which takes `FOR UPDATE` on the event's tier rows
 * first. That serialises concurrent checkouts for a single event, which is the
 * behaviour you want when 400 people hit "buy" on a drop at the same second —
 * a short queue is much better than an oversell.
 *
 * Locking every tier of the event (rather than only the ones being bought)
 * also keeps the event-wide `capacity` check honest, and ordering the lock by
 * `id` removes any chance of two transactions deadlocking on each other.
 */

type Tx = Prisma.TransactionClient;

/** Why a tier cannot currently be bought. `null` means it can. */
export type TierUnavailableReason =
  "SOLD_OUT" | "NOT_ON_SALE_YET" | "SALES_CLOSED" | "DISABLED" | "HIDDEN";

export type TierAvailability = {
  tierId: string;
  remaining: number;
  allocation: number;
  soldCount: number;
  unavailableReason: TierUnavailableReason | null;
  salesStartAt: Date | null;
  salesEndAt: Date | null;
};

type TierRow = {
  id: string;
  allocation: number;
  soldCount: number;
  heldCount: number;
  isActive: boolean;
  isHidden: boolean;
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

/**
 * Whether a tier is buyable right now. `unlockedHiddenTiers` carries the tier
 * ids revealed by an applied discount code.
 */
export function tierUnavailableReason(
  tier: TierRow,
  now: Date,
  unlockedHiddenTiers: readonly string[] = [],
): TierUnavailableReason | null {
  if (tier.isHidden && !unlockedHiddenTiers.includes(tier.id)) return "HIDDEN";
  if (!tier.isActive) return "DISABLED";
  if (tier.salesStartAt && now < tier.salesStartAt) return "NOT_ON_SALE_YET";
  if (tier.salesEndAt && now > tier.salesEndAt) return "SALES_CLOSED";
  if (remainingInTier(tier) <= 0) return "SOLD_OUT";
  return null;
}

export function toAvailability(
  tier: TierRow,
  now: Date,
  unlockedHiddenTiers: readonly string[] = [],
): TierAvailability {
  return {
    tierId: tier.id,
    remaining: remainingInTier(tier),
    allocation: tier.allocation,
    soldCount: tier.soldCount,
    unavailableReason: tierUnavailableReason(tier, now, unlockedHiddenTiers),
    salesStartAt: tier.salesStartAt,
    salesEndAt: tier.salesEndAt,
  };
}

/**
 * Tickets already committed against the event-wide capacity cap.
 * Sold + held across every tier.
 */
export function committedAgainstCapacity(
  tiers: readonly { soldCount: number; heldCount: number }[],
): number {
  return tiers.reduce((sum, t) => sum + t.soldCount + t.heldCount, 0);
}

/**
 * Comp tickets standing against the cap.
 *
 * Comps are minted rather than drawn, so they appear in no tier counter and
 * have to be counted from the ticket table. They are still people in the room:
 * comping fifty into a three-hundred-capacity venue leaves the public two
 * hundred and fifty, not three hundred.
 */
export async function compCountForEvent(
  tx: Tx,
  eventId: string,
): Promise<number> {
  return tx.ticket.count({
    where: { eventId, isComp: true, status: TicketStatus.VALID },
  });
}

/**
 * Everyone the event is currently committed to: sold, held, and given away.
 *
 * The one definition of "how full is this", shared by the capacity check, the
 * sold-out sweep and the comp accounting, so a number shown in the admin panel
 * is the same number the checkout enforces.
 */
export async function eventHeadcount(
  tx: Tx,
  eventId: string,
): Promise<{ headcount: number; fromTiers: number; comps: number }> {
  const [tiers, comps] = await Promise.all([
    tx.ticketTier.findMany({
      where: { eventId },
      select: { soldCount: true, heldCount: true },
    }),
    compCountForEvent(tx, eventId),
  ]);

  const fromTiers = committedAgainstCapacity(tiers);
  return { headcount: fromTiers + comps, fromTiers, comps };
}

/**
 * Run `fn` with the event's tier rows locked, having first released any holds
 * that have timed out. Every write to `soldCount`/`heldCount` must go through
 * here.
 */
export async function withEventInventoryLock<T>(
  eventId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.$transaction(
    async (tx) => {
      // Ordering by id makes the lock acquisition order deterministic, so two
      // concurrent transactions can never hold half of each other's rows.
      await tx.$queryRaw`
        SELECT id FROM "ticket_tier"
        WHERE "eventId" = ${eventId}
        ORDER BY id
        FOR UPDATE
      `;

      await releaseExpiredHolds(tx, eventId);

      return fn(tx);
    },
    // Long enough to survive a slow Stripe round trip on a cold lambda.
    { timeout: 15_000 },
  );
}

/**
 * Expire `PENDING` orders past their hold and give the inventory back.
 *
 * Called at the top of every locked section, so stock frees itself under load
 * without waiting for the cron sweep. Returns the number of orders expired.
 */
export async function releaseExpiredHolds(
  tx: Tx,
  eventId: string,
): Promise<number> {
  const now = new Date();

  const expired = await tx.ticketOrder.findMany({
    where: {
      eventId,
      status: TicketOrderStatus.PENDING,
      expiresAt: { lt: now },
    },
    select: { id: true, items: { select: { tierId: true, quantity: true } } },
  });

  if (expired.length === 0) return 0;

  const releasedByTier = new Map<string, number>();
  for (const order of expired) {
    for (const item of order.items) {
      releasedByTier.set(
        item.tierId,
        (releasedByTier.get(item.tierId) ?? 0) + item.quantity,
      );
    }
  }

  await tx.ticketOrder.updateMany({
    where: { id: { in: expired.map((o) => o.id) } },
    data: { status: TicketOrderStatus.EXPIRED, expiresAt: null },
  });

  for (const [tierId, quantity] of releasedByTier) {
    await tx.ticketTier.update({
      where: { id: tierId },
      // `max(0, ...)` guard lives in the reconcile job; a decrement below zero
      // here would mean a bug elsewhere, and clamping would hide it.
      data: { heldCount: { decrement: quantity } },
    });
  }

  return expired.length;
}

export class InventoryError extends Error {
  constructor(
    message: string,
    readonly code:
      | "TIER_NOT_FOUND"
      | "TIER_UNAVAILABLE"
      | "INSUFFICIENT_STOCK"
      | "EVENT_CAPACITY"
      | "MAX_PER_ORDER",
    readonly tierId?: string,
  ) {
    super(message);
    this.name = "InventoryError";
  }
}

export type RequestedLine = { tierId: string; quantity: number };

/**
 * Validate a basket against live stock and take the holds.
 *
 * Must be called inside `withEventInventoryLock`. Throws `InventoryError` if
 * anything is unavailable, which the caller turns into a user-facing message.
 */
export async function holdInventory(
  tx: Tx,
  {
    eventId,
    lines,
    unlockedHiddenTiers = [],
    now = new Date(),
  }: {
    eventId: string;
    lines: RequestedLine[];
    unlockedHiddenTiers?: readonly string[];
    now?: Date;
  },
): Promise<void> {
  const event = await tx.ticketEvent.findUniqueOrThrow({
    where: { id: eventId },
    select: { capacity: true, maxTicketsPerOrder: true },
  });

  const tiers = await tx.ticketTier.findMany({
    where: { eventId },
    select: {
      id: true,
      name: true,
      allocation: true,
      soldCount: true,
      heldCount: true,
      isActive: true,
      isHidden: true,
      salesStartAt: true,
      salesEndAt: true,
      maxPerOrder: true,
    },
  });
  const byId = new Map(tiers.map((t) => [t.id, t]));

  const totalRequested = lines.reduce((sum, l) => sum + l.quantity, 0);
  if (totalRequested > event.maxTicketsPerOrder) {
    throw new InventoryError(
      `You can buy at most ${event.maxTicketsPerOrder} tickets in one order.`,
      "MAX_PER_ORDER",
    );
  }

  for (const line of lines) {
    const tier = byId.get(line.tierId);
    if (!tier) {
      throw new InventoryError(
        "That ticket type is no longer available.",
        "TIER_NOT_FOUND",
        line.tierId,
      );
    }

    const reason = tierUnavailableReason(tier, now, unlockedHiddenTiers);
    if (reason && reason !== "SOLD_OUT") {
      throw new InventoryError(
        reason === "NOT_ON_SALE_YET"
          ? `${tier.name} is not on sale yet.`
          : `${tier.name} is no longer on sale.`,
        "TIER_UNAVAILABLE",
        tier.id,
      );
    }

    if (line.quantity > tier.maxPerOrder) {
      throw new InventoryError(
        `You can buy at most ${tier.maxPerOrder} × ${tier.name} in one order.`,
        "MAX_PER_ORDER",
        tier.id,
      );
    }

    const remaining = remainingInTier(tier);
    if (remaining < line.quantity) {
      throw new InventoryError(
        remaining === 0
          ? `${tier.name} just sold out.`
          : `Only ${remaining} × ${tier.name} left.`,
        "INSUFFICIENT_STOCK",
        tier.id,
      );
    }
  }

  if (event.capacity !== null) {
    // Comps are in the room too, so they come off what is left to sell.
    const committed =
      committedAgainstCapacity(tiers) + (await compCountForEvent(tx, eventId));
    if (committed + totalRequested > event.capacity) {
      const left = Math.max(0, event.capacity - committed);
      throw new InventoryError(
        left === 0
          ? "This event just sold out."
          : `Only ${left} tickets left for this event.`,
        "EVENT_CAPACITY",
      );
    }
  }

  for (const line of lines) {
    await tx.ticketTier.update({
      where: { id: line.tierId },
      data: { heldCount: { increment: line.quantity } },
    });
  }
}

/**
 * Turn an order's holds into sales. Called exactly once per order, at the
 * moment tickets are issued.
 */
export async function commitHold(
  tx: Tx,
  items: readonly { tierId: string; quantity: number }[],
): Promise<void> {
  for (const item of items) {
    await tx.ticketTier.update({
      where: { id: item.tierId },
      data: {
        heldCount: { decrement: item.quantity },
        soldCount: { increment: item.quantity },
      },
    });
  }
}

/** Give back an order's holds without selling — abandoned or failed payment. */
export async function releaseHold(
  tx: Tx,
  items: readonly { tierId: string; quantity: number }[],
): Promise<void> {
  for (const item of items) {
    await tx.ticketTier.update({
      where: { id: item.tierId },
      data: { heldCount: { decrement: item.quantity } },
    });
  }
}

/**
 * Return a refunded/voided ticket's seat to the pool.
 */
export async function returnToStock(
  tx: Tx,
  tierId: string,
  quantity = 1,
): Promise<void> {
  await tx.ticketTier.update({
    where: { id: tierId },
    data: { soldCount: { decrement: quantity } },
  });
}
