/**
 * Money for ticketing. Integer cents only — never floats.
 *
 * Everything here is GST-INCLUSIVE, which is how prices must be shown to NZ
 * consumers. A $25.00 ticket costs the buyer $25.00, and $3.26 of that is GST.
 * The GST *component* of a GST-inclusive amount is `total * rate / (1 + rate)`,
 * which at 15% is the familiar `total * 3 / 23`.
 *
 * Client-safe: pure arithmetic, no server imports.
 */

/** 15% expressed in basis points. */
export const DEFAULT_GST_RATE_BP = 1500;

export type BookingFeeConfig = {
  /** Charged once per ticket, not per order. */
  fixedCents: number;
  /** Basis points applied to the discounted subtotal. 250 == 2.5%. */
  percentBp: number;
};

export const ZERO_BOOKING_FEE: BookingFeeConfig = {
  fixedCents: 0,
  percentBp: 0,
};

export type OrderLine = {
  unitPriceCents: number;
  quantity: number;
};

export type OrderTotals = {
  subtotalCents: number;
  discountCents: number;
  bookingFeeCents: number;
  totalCents: number;
  /** Component of `totalCents`, not added on top. */
  gstCents: number;
  quantity: number;
};

/**
 * Round half away from zero. `Math.round` rounds -0.5 to -0, which would make
 * refund arithmetic drift; every amount here is non-negative, but being
 * explicit keeps it that way.
 */
function roundCents(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

/** The GST portion contained within a GST-inclusive amount. */
export function gstComponentCents(
  inclusiveCents: number,
  rateBp: number = DEFAULT_GST_RATE_BP,
): number {
  if (inclusiveCents <= 0 || rateBp <= 0) return 0;
  return roundCents((inclusiveCents * rateBp) / (10_000 + rateBp));
}

/**
 * Booking fee for an order.
 *
 * The fixed part is per ticket; the percentage applies to the subtotal after
 * any discount. A fully discounted (or free) order is never charged a booking
 * fee — nobody expects to pay $1.50 for a free ticket.
 */
export function calcBookingFeeCents(
  discountedSubtotalCents: number,
  quantity: number,
  fee: BookingFeeConfig,
): number {
  if (discountedSubtotalCents <= 0 || quantity <= 0) return 0;
  const fixed = fee.fixedCents * quantity;
  const percent = roundCents(
    (discountedSubtotalCents * fee.percentBp) / 10_000,
  );
  return Math.max(0, fixed + percent);
}

/**
 * Full order arithmetic in one place, so the buy panel, the checkout session
 * and the receipt can never disagree about a total.
 *
 * `discountCents` is clamped to the subtotal: a $20 fixed-amount code on a $15
 * order discounts $15, it does not create a $5 credit.
 */
export function computeOrderTotals({
  lines,
  discountCents = 0,
  fee = ZERO_BOOKING_FEE,
  gstRateBp = DEFAULT_GST_RATE_BP,
}: {
  lines: OrderLine[];
  discountCents?: number;
  fee?: BookingFeeConfig;
  gstRateBp?: number;
}): OrderTotals {
  const subtotalCents = lines.reduce(
    (sum, line) => sum + line.unitPriceCents * line.quantity,
    0,
  );
  const quantity = lines.reduce((sum, line) => sum + line.quantity, 0);

  const appliedDiscount = Math.max(
    0,
    Math.min(roundCents(discountCents), subtotalCents),
  );
  const discountedSubtotal = subtotalCents - appliedDiscount;
  const bookingFeeCents = calcBookingFeeCents(
    discountedSubtotal,
    quantity,
    fee,
  );
  const totalCents = discountedSubtotal + bookingFeeCents;

  return {
    subtotalCents,
    discountCents: appliedDiscount,
    bookingFeeCents,
    totalCents,
    gstCents: gstComponentCents(totalCents, gstRateBp),
    quantity,
  };
}

/**
 * Value of a discount code against a subtotal.
 *
 * PERCENT codes carry basis points (1000 == 10%); FIXED codes carry cents.
 */
export function calcDiscountCents(
  eligibleSubtotalCents: number,
  type: "PERCENT" | "FIXED",
  value: number,
): number {
  if (eligibleSubtotalCents <= 0 || value <= 0) return 0;
  const raw =
    type === "PERCENT"
      ? roundCents((eligibleSubtotalCents * value) / 10_000)
      : value;
  return Math.min(raw, eligibleSubtotalCents);
}

const nzdFormatter = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
});

/** `2500` -> `"$25.00"`. */
export function formatNZD(cents: number): string {
  return nzdFormatter.format(cents / 100);
}

/** `2500` -> `"$25"`, `2550` -> `"$25.50"`. For tight spaces like tier chips. */
export function formatNZDCompact(cents: number): string {
  if (cents % 100 === 0) return `$${cents / 100}`;
  return formatNZD(cents);
}

/** Parse a user-typed price ("25", "25.50", "$25.50") into cents. */
export function parsePriceToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "").trim();
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}
