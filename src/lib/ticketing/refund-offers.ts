import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The pure parts of refund offers: what one refunds, the signed link, and
 * how the buyer's email is shown. The server side is
 * `~/server/ticketing/refund-offers`, which supplies the key.
 */

export type OfferAmount = "everything" | "ticketsOnly";

/**
 * What an offer on this order refunds. Everything is what is left of what
 * they paid; tickets only is what the valid tickets cost after any
 * discount, so booking fees stay with us. Taking it is capped again by
 * Stripe at the time.
 */
export function offerAmountCents(
  order: OrderMoney & { totalCents: number; refundedCents: number },
  amount: OfferAmount,
) {
  const left = Math.max(0, order.totalCents - order.refundedCents);
  if (amount === "everything") return left;
  return Math.min(discountedTicketCents(order), left);
}

type OrderMoney = {
  subtotalCents: number;
  discountCents: number;
  tickets: { pricePaidCents: number }[];
};

/**
 * What the valid tickets cost after the order's discount. Tickets keep their
 * full price, and a discount comes off the whole order, so each ticket
 * carries its share of it.
 */
export function discountedTicketCents(order: OrderMoney) {
  const full = order.tickets.reduce((sum, t) => sum + t.pricePaidCents, 0);
  if (order.subtotalCents <= 0 || order.discountCents <= 0) return full;
  const kept = Math.max(0, order.subtotalCents - order.discountCents);
  return Math.round((full * kept) / order.subtotalCents);
}

const sign = (key: string, payload: string) =>
  createHmac("sha256", key).update(payload).digest("base64url").slice(0, 22);

/** `<offerId>.<signature>`. Cuids have no dots. */
export function signOfferId(key: string, offerId: string) {
  return `${offerId}.${sign(key, offerId)}`;
}

/** The offer id in a link, or null for one that is not ours. */
export function readOfferId(key: string, token: string): string | null {
  const [offerId, given, ...rest] = token.split(".");
  if (!offerId || !given || rest.length) return null;
  const a = Buffer.from(given);
  const b = Buffer.from(sign(key, offerId));
  return a.length === b.length && timingSafeEqual(a, b) ? offerId : null;
}

/** `sam.taylor@gmail.com` → `s•••@gmail.com`, to say where the code went. */
export function maskEmail(email: string) {
  const [name = "", domain = ""] = email.split("@");
  return `${name.slice(0, 1)}•••@${domain}`;
}

const DAY_MS = 86_400_000;

/**
 * When an offer closes unless the admin picks otherwise: a day before the
 * event starts, so a refund is settled before the doors open. An event that
 * is less than a day away, or already over, gets two weeks instead, since an
 * offer has to stay open for at least an hour.
 */
export function defaultOfferExpiry(startsAt: Date, now = new Date()) {
  const dayBefore = new Date(startsAt.getTime() - DAY_MS);
  return dayBefore.getTime() - now.getTime() > 60 * 60_000
    ? dayBefore
    : new Date(now.getTime() + 14 * DAY_MS);
}
