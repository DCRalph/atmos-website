import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The pure parts of refund offers: what one refunds, the signed link, and
 * how the buyer's email is shown. The server side is
 * `~/server/ticketing/refund-offers`, which supplies the key.
 */

export type OfferAmount = "everything" | "ticketsOnly";

/**
 * What an offer on this order refunds. Everything is what is left of what
 * they paid; tickets only is what the valid tickets cost, so booking fees
 * stay with us. Taking it is capped again by Stripe at the time.
 */
export function offerAmountCents(
  order: {
    totalCents: number;
    refundedCents: number;
    tickets: { pricePaidCents: number }[];
  },
  amount: OfferAmount,
) {
  const left = Math.max(0, order.totalCents - order.refundedCents);
  if (amount === "everything") return left;
  const tickets = order.tickets.reduce((sum, t) => sum + t.pricePaidCents, 0);
  return Math.min(tickets, left);
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
