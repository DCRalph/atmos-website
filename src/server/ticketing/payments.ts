import "server-only";

import { getStripe, isStripeConfigured } from "~/server/stripe";

/**
 * Cancel the PaymentIntent on an order that is about to stop holding anything,
 * so the buyer can't pay for seats that have gone back on sale.
 *
 * Returns false when Stripe already has the money or is part way through
 * taking it: that order is about to be issued, not abandoned, and is left for
 * the webhook. Throws if Stripe can't be reached, which callers treat the same
 * way. Never call this inside a transaction.
 */
export async function stopUnpaidPayment(
  paymentIntentId: string | null,
): Promise<boolean> {
  if (!paymentIntentId || !isStripeConfigured()) return true;

  const stripe = getStripe();
  // Short, because a lapsed hold is swept before every inventory lock: a slow
  // Stripe must not stall a door sale behind it.
  const options = { timeout: 8_000 };

  const intent = await stripe.paymentIntents.retrieve(
    paymentIntentId,
    {},
    options,
  );
  if (intent.status === "canceled") return true;
  if (intent.status === "succeeded" || intent.status === "processing") {
    return false;
  }

  try {
    await stripe.paymentIntents.cancel(intent.id, {}, options);
    return true;
  } catch {
    // Stripe refuses to cancel an intent the buyer has just paid. Anything
    // other than "it's cancelled now" keeps the hold.
    const latest = await stripe.paymentIntents.retrieve(intent.id, {}, options);
    return latest.status === "canceled";
  }
}
