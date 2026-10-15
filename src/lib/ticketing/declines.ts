import { paidWithLabel } from "./payment-methods";

/**
 * Declined payments: what happened to an order after a card was declined on
 * it, and the numbers across many of them. The rows come from
 * `~/server/ticketing/declines.ts`; everything here is pure so the order
 * dialog, the analytics card and the tests share one reading of them.
 *
 * A buyer who gets declined does one of four things:
 *  - `retried`:    tries again on the same order and pays
 *  - `new_order`:  starts again and pays on another order for the event
 *  - `no_tickets`: pays, but the order was never issued. Stripe has the money
 *                  and the buyer has nothing, so it needs a person.
 *  - `lost`:       never pays
 */

export type DeclineOutcome = "retried" | "new_order" | "no_tickets" | "lost";

/** The card or wallet behind one payment try. */
export type PaymentCard = {
  paidWith: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
};

/** One declined order, as read from the database. */
export type DeclineRow = {
  orderId: string;
  orderNumber: string;
  eventId: string;
  status: string;
  buyerName: string | null;
  email: string | null;
  totalCents: number;
  paidAt: Date | null;
  /** The first decline. */
  declinedAt: Date;
  /** The last decline's, the one they gave up or tried again after. */
  reason: string | null;
  declined: PaymentCard;
  /** The first accepted try on this order, if any. */
  accepted: (PaymentCard & { at: Date }) | null;
  /** The order they paid on instead, if they came back. */
  next:
    (PaymentCard & { id: string; orderNumber: string; paidAt: Date }) | null;
};

export type Decline = Omit<DeclineRow, "accepted" | "next" | "paidAt"> & {
  outcome: DeclineOutcome;
  /** When they got through, wherever it was. */
  paidAt: Date | null;
  nextOrder: { id: string; orderNumber: string } | null;
  /** Paid on another card or wallet. Null when unknown or never paid. */
  switched: boolean | null;
};

const BOUGHT = new Set(["PAID", "PARTIALLY_REFUNDED", "REFUNDED"]);

function switchedCard(from: PaymentCard, to: PaymentCard | null) {
  if (!to?.paidWith) return null;
  return from.paidWith !== to.paidWith || from.cardLast4 !== to.cardLast4;
}

export function classifyDecline(row: DeclineRow): Decline {
  const { accepted, next, paidAt, ...rest } = row;
  const base = { ...rest, nextOrder: null };

  if (BOUGHT.has(row.status) && paidAt) {
    return {
      ...base,
      outcome: "retried",
      paidAt: accepted?.at ?? paidAt,
      switched: switchedCard(row.declined, accepted),
    };
  }
  if (accepted) {
    return {
      ...base,
      outcome: "no_tickets",
      paidAt: accepted.at,
      switched: switchedCard(row.declined, accepted),
    };
  }
  if (next) {
    return {
      ...base,
      outcome: "new_order",
      paidAt: next.paidAt,
      nextOrder: { id: next.id, orderNumber: next.orderNumber },
      switched: switchedCard(row.declined, next),
    };
  }
  return { ...base, outcome: "lost", paidAt: null, switched: null };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid] ?? 0;
  return sorted.length % 2 ? upper : ((sorted[mid - 1] ?? upper) + upper) / 2;
}

/**
 * The headline across declined orders. "Came back" counts everybody who paid
 * in the end, `no_tickets` included: the buyer did come back, it was the
 * site that failed them, and that has its own warning.
 */
export function summariseDeclines(declines: Decline[]) {
  const count = (outcome: DeclineOutcome) =>
    declines.filter((d) => d.outcome === outcome).length;
  const cameBack = declines.filter((d) => d.outcome !== "lost");
  const lost = declines.filter((d) => d.outcome === "lost");
  const sum = (rows: Decline[]) =>
    rows.reduce((total, d) => total + d.totalCents, 0);

  const reasons = new Map<string, number>();
  for (const d of declines) {
    const label = declineReasonLabel(d.reason);
    reasons.set(label, (reasons.get(label) ?? 0) + 1);
  }

  return {
    declined: declines.length,
    cameBack: cameBack.length,
    retried: count("retried"),
    newOrder: count("new_order"),
    noTickets: count("no_tickets"),
    lost: lost.length,
    recoveredCents: sum(cameBack),
    lostCents: sum(lost),
    /** Median seconds from the first decline to paying. */
    secondsBack: median(
      cameBack.flatMap((d) =>
        d.paidAt ? [(d.paidAt.getTime() - d.declinedAt.getTime()) / 1000] : [],
      ),
    ),
    sameCard: cameBack.filter((d) => d.switched === false).length,
    switched: cameBack.filter((d) => d.switched === true).length,
    reasons: [...reasons]
      .map(([label, n]) => ({ label, n }))
      .sort((a, b) => b.n - a.n),
  };
}

export type DeclineSummary = ReturnType<typeof summariseDeclines>;

/**
 * Stripe's decline reasons in words. The bank's reason when it gave one
 * (`insufficient_funds`), otherwise Stripe's code. Radar's risk levels are
 * Stripe blocking it, not the bank.
 */
const REASONS: Record<string, string> = {
  insufficient_funds: "Insufficient funds",
  generic_decline: "Declined",
  do_not_honor: "Declined",
  card_declined: "Declined",
  payment_intent_payment_attempt_failed: "Declined",
  expired_card: "Expired card",
  incorrect_cvc: "Wrong security code",
  invalid_cvc: "Wrong security code",
  incorrect_number: "Wrong card number",
  invalid_expiry_year: "Wrong expiry date",
  invalid_expiry_month: "Wrong expiry date",
  lost_card: "Card reported lost",
  stolen_card: "Card reported stolen",
  card_velocity_exceeded: "Over the card's limit",
  withdrawal_count_limit_exceeded: "Over the card's limit",
  card_not_supported: "Card not supported",
  currency_not_supported: "Currency not supported",
  processing_error: "Processing error",
  try_again_later: "Bank said try later",
  authentication_required: "Failed 3D Secure",
  payment_intent_authentication_failure: "Failed 3D Secure",
  fraudulent: "Bank flagged as fraud",
  highest_risk_level: "Blocked by Stripe as risky",
  elevated_risk_level: "Blocked by Stripe as risky",
};

export function declineReasonLabel(reason: string | null): string {
  if (!reason) return "Declined";
  const label = REASONS[reason] ?? reason.replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const BRANDS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  unionpay: "UnionPay",
  jcb: "JCB",
  diners: "Diners",
  discover: "Discover",
  eftpos_au: "Eftpos",
};

/** "Visa ••4410", "Apple Pay ••7712", "Afterpay". */
export function paymentCardLabel(card: PaymentCard): string {
  const wallet =
    card.paidWith && !card.paidWith.startsWith("card") ? card.paidWith : null;
  const name = wallet
    ? paidWithLabel(wallet)
    : card.cardBrand
      ? (BRANDS[card.cardBrand] ?? paidWithLabel(card.cardBrand))
      : "Card";
  return card.cardLast4 ? `${name} ••${card.cardLast4}` : name;
}
