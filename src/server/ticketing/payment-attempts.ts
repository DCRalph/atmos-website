import "server-only";

import type Stripe from "stripe";

import { PaymentAttemptStatus } from "~Prisma/client";
import { db } from "~/server/db";
import { getStripe, paidWithFromCharge } from "~/server/stripe";

/**
 * Every try at paying an order, declines included. Stripe keeps one charge
 * per try on the payment intent; the order only keeps how it ended, so a
 * buyer whose card was declined and who paid on the next go looks like any
 * other paid order without these.
 */

function attemptFromCharge(charge: Stripe.Charge) {
  const card =
    charge.payment_method_details?.card ??
    charge.payment_method_details?.card_present;
  return {
    // Anything Stripe adds later reads as still in flight.
    status:
      charge.status === "succeeded"
        ? PaymentAttemptStatus.SUCCEEDED
        : charge.status === "failed"
          ? PaymentAttemptStatus.FAILED
          : PaymentAttemptStatus.PENDING,
    amountCents: charge.amount,
    paidWith: paidWithFromCharge(charge),
    cardBrand: card?.brand ?? null,
    cardLast4: card?.last4 ?? null,
    failureCode: charge.failure_code,
    declineReason: charge.outcome?.reason ?? null,
    email: charge.billing_details.email?.toLowerCase().trim() ?? null,
    attemptedAt: new Date(charge.created * 1000),
  };
}

/**
 * Read every charge on an order's payment intent back from Stripe and record
 * it. Called by the webhook on each success and decline, and by the backfill.
 * Safe to repeat: charges are keyed by their Stripe id.
 */
export async function syncPaymentAttempts(
  orderId: string,
  paymentIntentId: string,
): Promise<void> {
  // A deleted order's late webhook has nothing to attach to.
  const order = await db.ticketOrder.findUnique({
    where: { id: orderId },
    select: { id: true },
  });
  if (!order) return;

  const charges = await getStripe().charges.list({
    payment_intent: paymentIntentId,
    limit: 100,
  });

  for (const charge of charges.data) {
    const attempt = attemptFromCharge(charge);
    await db.ticketPaymentAttempt.upsert({
      where: { stripeChargeId: charge.id },
      create: { orderId, stripeChargeId: charge.id, ...attempt },
      update: attempt,
    });
  }
}
