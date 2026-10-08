import "server-only";

import { TRPCError } from "@trpc/server";

import { DiscountCodeType, type Prisma } from "~Prisma/client";
import { ticketCount } from "~/lib/ticketing/capacity";
import { calcDiscountCents } from "~/lib/ticketing/money";

/**
 * Discount codes.
 *
 * A code can be scoped to one event and/or a subset of tiers, capped by total
 * redemptions and by per-email use, gated by a date window and a minimum ticket
 * count, and can reveal otherwise-hidden tiers (presales, guest lists).
 *
 * Per-email caps are only enforceable when we know the buyer's email. In the
 * seamless guest flow we deliberately do not have it until Stripe hands it
 * over *after* payment, so for paid checkouts that cap is best-effort: the
 * global `maxRedemptions` is the hard limit. Refusing to issue a ticket
 * somebody has already paid for would be a far worse outcome than one extra
 * use of a code.
 */

type Tx = Prisma.TransactionClient;

export type AppliedDiscount = {
  codeId: string;
  code: string;
  amountCents: number;
  /** Hidden tiers this code makes purchasable. */
  unlockedTierIds: string[];
};

export type PricedLine = {
  tierId: string;
  /** Purchases; tickets are `quantity * groupSize`. */
  quantity: number;
  groupSize: number;
  unitPriceCents: number;
};

export class DiscountError extends TRPCError {
  constructor(message: string) {
    super({ code: "BAD_REQUEST", message });
  }
}

export function normaliseCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Find a code and check the rules that don't depend on a basket: active, this
 * event, inside its window, uses left. Shared by checkout and by the buy
 * panel's code box, which runs before anything has been picked.
 */
async function findUsableCode(
  tx: Tx,
  { code, eventId, now }: { code: string; eventId: string; now: Date },
) {
  const record = await tx.discountCode.findUnique({
    where: { code: normaliseCode(code) },
  });

  if (!record?.isActive) {
    throw new DiscountError("That discount code isn't valid.");
  }
  if (record.eventId && record.eventId !== eventId) {
    throw new DiscountError("That code doesn't apply to this event.");
  }
  if (record.startsAt && now < record.startsAt) {
    throw new DiscountError("That code isn't active yet.");
  }
  if (record.endsAt && now > record.endsAt) {
    throw new DiscountError("That code has expired.");
  }
  if (
    record.maxRedemptions !== null &&
    record.redemptionCount >= record.maxRedemptions
  ) {
    throw new DiscountError("That code has been fully redeemed.");
  }
  return record;
}

/**
 * The hidden tiers a code opens on this event: its chosen tiers, or every
 * hidden tier when none were chosen. Only an event's own code unlocks
 * anything; a code for any event is a discount and nothing more.
 */
async function unlockedTierIdsFor(
  tx: Tx,
  record: {
    eventId: string | null;
    unlocksHiddenTiers: boolean;
    tierIds: string[];
  },
  eventId: string,
): Promise<string[]> {
  if (!record.unlocksHiddenTiers || record.eventId !== eventId) return [];
  const hidden = await tx.ticketTier.findMany({
    where: {
      eventId,
      isHidden: true,
      ...(record.tierIds.length > 0 ? { id: { in: record.tierIds } } : {}),
    },
    select: { id: true },
  });
  return hidden.map((t) => t.id);
}

/**
 * Check a code before a basket exists and say which hidden tiers it opens.
 * Throws `DiscountError` with a buyer-facing message when it can't be used.
 */
export async function previewDiscountCode(
  tx: Tx,
  {
    code,
    eventId,
    now = new Date(),
  }: { code: string; eventId: string; now?: Date },
): Promise<{ code: string; unlockedTierIds: string[] }> {
  const record = await findUsableCode(tx, { code, eventId, now });
  return {
    code: record.code,
    unlockedTierIds: await unlockedTierIdsFor(tx, record, eventId),
  };
}

/**
 * Validate a code against a basket and work out what it is worth.
 * Does not record anything — redemption is written at issuance time, so
 * abandoned checkouts never burn a code.
 */
export async function applyDiscountCode(
  tx: Tx,
  {
    code,
    eventId,
    lines,
    email,
    now = new Date(),
  }: {
    code: string;
    eventId: string;
    lines: PricedLine[];
    email?: string | null;
    now?: Date;
  },
): Promise<AppliedDiscount> {
  const record = await findUsableCode(tx, { code, eventId, now });

  const totalQuantity = ticketCount(lines);
  if (record.minTickets !== null && totalQuantity < record.minTickets) {
    throw new DiscountError(
      `That code needs at least ${record.minTickets} tickets.`,
    );
  }

  if (email && record.maxPerEmail !== null) {
    const used = await tx.discountRedemption.count({
      where: { codeId: record.id, email: email.toLowerCase().trim() },
    });
    if (used >= record.maxPerEmail) {
      throw new DiscountError("You've already used that code.");
    }
  }

  const scopedTierIds = record.tierIds;
  const eligibleLines =
    scopedTierIds.length === 0
      ? lines
      : lines.filter((line) => scopedTierIds.includes(line.tierId));

  const eligibleSubtotal = eligibleLines.reduce(
    (sum, line) => sum + line.unitPriceCents * line.quantity,
    0,
  );

  const unlockedTierIds = await unlockedTierIdsFor(tx, record, eventId);
  const unlocksBasket = lines.some((line) =>
    unlockedTierIds.includes(line.tierId),
  );

  // An unlock code has done its job once the basket holds what it opened, even
  // with nothing to take off: a free guest list tier, or a code worth 0%.
  if (eligibleSubtotal <= 0 && !unlocksBasket) {
    throw new DiscountError(
      "That code doesn't apply to the tickets you've chosen.",
    );
  }

  const amountCents = calcDiscountCents(
    eligibleSubtotal,
    record.type === DiscountCodeType.PERCENT ? "PERCENT" : "FIXED",
    record.value,
  );

  return { codeId: record.id, code: record.code, amountCents, unlockedTierIds };
}

/**
 * Burn one use of a code. Called inside the issuance transaction, so only
 * orders that actually became tickets count against the limit.
 */
export async function recordRedemption(
  tx: Tx,
  {
    codeId,
    orderId,
    email,
    amountCents,
  }: {
    codeId: string;
    orderId: string;
    email?: string | null;
    amountCents: number;
  },
): Promise<void> {
  const created = await tx.discountRedemption.createMany({
    data: [
      {
        codeId,
        orderId,
        email: email?.toLowerCase().trim() ?? null,
        amountCents,
      },
    ],
    // Re-running issuance for an already-issued order must not double count.
    skipDuplicates: true,
  });

  if (created.count > 0) {
    await tx.discountCode.update({
      where: { id: codeId },
      data: { redemptionCount: { increment: 1 } },
    });
  }
}

/** Undo a redemption when an order is fully refunded. */
export async function releaseRedemption(
  tx: Tx,
  { codeId, orderId }: { codeId: string; orderId: string },
): Promise<void> {
  const deleted = await tx.discountRedemption.deleteMany({
    where: { codeId, orderId },
  });
  if (deleted.count > 0) {
    await tx.discountCode.update({
      where: { id: codeId },
      data: { redemptionCount: { decrement: deleted.count } },
    });
  }
}

/** Human-readable summary for admin tables and the checkout line item. */
export function describeDiscount(code: {
  type: DiscountCodeType;
  value: number;
}): string {
  return code.type === DiscountCodeType.PERCENT
    ? `${code.value / 100}% off`
    : `$${(code.value / 100).toFixed(2)} off`;
}
