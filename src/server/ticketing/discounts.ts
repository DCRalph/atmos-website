import "server-only";

import { TRPCError } from "@trpc/server";

import { DiscountCodeType, type Prisma } from "~Prisma/client";
import { ticketCount } from "~/lib/ticketing/capacity";
import { calcDiscountCents } from "~/lib/ticketing/money";

/**
 * Discount codes, in two kinds.
 *
 * A global `DiscountCode` works on any event and is only ever a discount. An
 * `EventCode` belongs to one event: besides a discount (which may be zero) it
 * can be scoped to some of that event's tiers and unlock its hidden ones, which
 * is how a presale or a guest list works. A buyer types either into the same
 * box; the event's own code is looked up first, so it wins a shared string.
 *
 * Both are capped by total redemptions and by per-email use, gated by a date
 * window and a minimum ticket count.
 *
 * Per-email caps are only enforceable when we know the buyer's email. In the
 * seamless guest flow we deliberately do not have it until Stripe hands it
 * over *after* payment, so for paid checkouts that cap is best-effort: the
 * global `maxRedemptions` is the hard limit. Refusing to issue a ticket
 * somebody has already paid for would be a far worse outcome than one extra
 * use of a code.
 */

type Tx = Prisma.TransactionClient;

/** Which table a code lives in, and its row. */
export type CodeRef = { kind: "GLOBAL" | "EVENT"; id: string };

export type AppliedDiscount = {
  ref: CodeRef;
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

/** The code an order used, read off its two columns. */
export function orderCodeRef(order: {
  discountCodeId: string | null;
  eventCodeId: string | null;
}): CodeRef | null {
  if (order.eventCodeId) return { kind: "EVENT", id: order.eventCodeId };
  if (order.discountCodeId) return { kind: "GLOBAL", id: order.discountCodeId };
  return null;
}

/** The order columns that record a code, for writing onto a new order. */
export function orderCodeColumns(ref: CodeRef | null) {
  return {
    discountCodeId: ref?.kind === "GLOBAL" ? ref.id : null,
    eventCodeId: ref?.kind === "EVENT" ? ref.id : null,
  };
}

/** A code from either table, flattened. A global code unlocks nothing. */
async function findCode(tx: Tx, code: string, eventId: string) {
  const normalised = normaliseCode(code);
  const own = await tx.eventCode.findUnique({
    where: { eventId_code: { eventId, code: normalised } },
  });
  if (own) return { ...own, ref: { kind: "EVENT", id: own.id } as CodeRef };

  const global = await tx.discountCode.findUnique({
    where: { code: normalised },
  });
  if (!global) return null;
  return {
    ...global,
    tierIds: [] as string[],
    unlocksHiddenTiers: false,
    ref: { kind: "GLOBAL", id: global.id } as CodeRef,
  };
}

/**
 * Find a code and check the rules that don't depend on a basket: active,
 * inside its window, uses left. Shared by checkout and by the buy panel's code
 * box, which runs before anything has been picked.
 */
async function findUsableCode(
  tx: Tx,
  { code, eventId, now }: { code: string; eventId: string; now: Date },
) {
  const record = await findCode(tx, code, eventId);

  if (!record?.isActive) {
    throw new DiscountError("That discount code isn't valid.");
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
 * hidden tier when none were chosen.
 */
async function unlockedTierIdsFor(
  tx: Tx,
  record: { unlocksHiddenTiers: boolean; tierIds: string[] },
  eventId: string,
): Promise<string[]> {
  if (!record.unlocksHiddenTiers) return [];
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
    const byEmail = { codeId: record.id, email: email.toLowerCase().trim() };
    const used =
      record.ref.kind === "EVENT"
        ? await tx.eventCodeRedemption.count({ where: byEmail })
        : await tx.discountRedemption.count({ where: byEmail });
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

  return { ref: record.ref, code: record.code, amountCents, unlockedTierIds };
}

/**
 * Burn one use of a code. Called inside the issuance transaction, so only
 * orders that actually became tickets count against the limit. Counts a use
 * worth nothing too: that is what caps a guest list key.
 */
export async function recordRedemption(
  tx: Tx,
  {
    ref,
    orderId,
    email,
    amountCents,
  }: {
    ref: CodeRef;
    orderId: string;
    email?: string | null;
    amountCents: number;
  },
): Promise<void> {
  const row = {
    codeId: ref.id,
    orderId,
    email: email?.toLowerCase().trim() ?? null,
    amountCents,
  };
  // Re-running issuance for an already-issued order must not double count.
  const created =
    ref.kind === "EVENT"
      ? await tx.eventCodeRedemption.createMany({
          data: [row],
          skipDuplicates: true,
        })
      : await tx.discountRedemption.createMany({
          data: [row],
          skipDuplicates: true,
        });
  if (created.count === 0) return;

  const bump = { redemptionCount: { increment: 1 } };
  if (ref.kind === "EVENT") {
    await tx.eventCode.update({ where: { id: ref.id }, data: bump });
  } else {
    await tx.discountCode.update({ where: { id: ref.id }, data: bump });
  }
}

/** Give a use back, when the order it went on is deleted. */
export async function releaseRedemption(
  tx: Tx,
  { ref, orderId }: { ref: CodeRef; orderId: string },
): Promise<void> {
  const where = { codeId: ref.id, orderId };
  const deleted =
    ref.kind === "EVENT"
      ? await tx.eventCodeRedemption.deleteMany({ where })
      : await tx.discountRedemption.deleteMany({ where });
  if (deleted.count === 0) return;

  const drop = { redemptionCount: { decrement: deleted.count } };
  if (ref.kind === "EVENT") {
    await tx.eventCode.update({ where: { id: ref.id }, data: drop });
  } else {
    await tx.discountCode.update({ where: { id: ref.id }, data: drop });
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
