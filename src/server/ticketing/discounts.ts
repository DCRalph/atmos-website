import "server-only";

import { TRPCError } from "@trpc/server";

import { DiscountCodeType, type Prisma } from "~Prisma/client";
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
  quantity: number;
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
  const normalised = normaliseCode(code);
  const record = await tx.discountCode.findUnique({
    where: { code: normalised },
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

  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
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

  if (eligibleSubtotal <= 0) {
    throw new DiscountError(
      "That code doesn't apply to the tickets you've chosen.",
    );
  }

  const amountCents = calcDiscountCents(
    eligibleSubtotal,
    record.type === DiscountCodeType.PERCENT ? "PERCENT" : "FIXED",
    record.value,
  );

  let unlockedTierIds: string[] = [];
  if (record.unlocksHiddenTiers) {
    if (scopedTierIds.length > 0) {
      unlockedTierIds = scopedTierIds;
    } else {
      const hidden = await tx.ticketTier.findMany({
        where: { eventId, isHidden: true },
        select: { id: true },
      });
      unlockedTierIds = hidden.map((t) => t.id);
    }
  }

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
