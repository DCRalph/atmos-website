import type { NextRequest } from "next/server";
import type Stripe from "stripe";

import {
  ActivityType,
  PaymentMethodKind,
  TicketOrderStatus,
  TicketStatus,
} from "~Prisma/client";
import { env } from "~/env";
import { db } from "~/server/db";
import { getStripe } from "~/server/stripe";
import { sendTicketEmail } from "~/server/ticketing/email/send";
import {
  cancelPendingOrder,
  issueTicketsForOrder,
  syncMarketingConsent,
  voidTicket,
} from "~/server/ticketing/orders";
import { logActivity } from "~/server/utils/activity-log";

/**
 * Stripe webhook — the authority on whether an order was paid.
 *
 * The browser also calls `ticketCheckout.confirm` the instant Stripe reports
 * success, which is what makes tickets appear immediately. Both paths run the
 * same idempotent issuance, so whichever arrives first does the work and the
 * other one is a no-op. If the buyer closes the tab mid-redirect, this is what
 * still gets them their tickets.
 */

// Signature verification needs the raw body, and this must never be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    console.error("[stripe] STRIPE_WEBHOOK_SECRET is not set");
    return new Response("Webhook not configured", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature", { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      payload,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (cause) {
    console.error("[stripe] signature verification failed", cause);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentSucceeded(event.data.object);
        break;
      case "payment_intent.payment_failed":
      case "payment_intent.canceled":
        await handlePaymentFailed(event.data.object);
        break;
      case "charge.refunded":
        await handleChargeRefunded(event.data.object);
        break;
      case "charge.dispute.created":
        await handleDisputeOpened(event.data.object);
        break;
      default:
        break;
    }
  } catch (cause) {
    // A non-2xx tells Stripe to retry, which is what we want for a transient
    // database blip. The handlers are idempotent, so a retry is safe.
    console.error(`[stripe] handler failed for ${event.type}`, cause);
    return new Response("Handler error", { status: 500 });
  }

  return Response.json({ received: true });
}

async function handlePaymentSucceeded(
  intent: Stripe.PaymentIntent,
): Promise<void> {
  const orderId = intent.metadata?.orderId;
  if (!orderId) return;

  const charge =
    typeof intent.latest_charge === "string"
      ? await getStripe().charges.retrieve(intent.latest_charge)
      : (intent.latest_charge ?? null);

  // Apple Pay / Google Pay / Link all populate billing details, which is how
  // the buyer's email reaches us without them ever typing it.
  const email = intent.receipt_email ?? charge?.billing_details?.email ?? null;

  const result = await issueTicketsForOrder({
    orderId,
    buyerEmail: email,
    buyerName: charge?.billing_details?.name ?? null,
    buyerPhone: charge?.billing_details?.phone ?? null,
    paymentIntentId: intent.id,
    chargeId: charge?.id ?? null,
    paymentMethod: PaymentMethodKind.STRIPE,
  });

  if (result.alreadyIssued) return;

  await syncMarketingConsent(orderId);

  await logActivity({
    type: ActivityType.TICKET_ORDER_PAID,
    action: `Order paid — ${result.ticketIds.length} ticket(s)`,
    details: { orderId, paymentIntentId: intent.id },
  });

  await sendTicketEmail({ orderId });
}

async function handlePaymentFailed(
  intent: Stripe.PaymentIntent,
): Promise<void> {
  const orderId = intent.metadata?.orderId;
  if (!orderId) return;

  // Release the held seats straight away rather than making the next buyer
  // wait out the full hold window.
  await cancelPendingOrder(orderId, TicketOrderStatus.FAILED);
}

async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  const order = await db.ticketOrder.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    include: {
      tickets: { where: { status: TicketStatus.VALID }, select: { id: true } },
    },
  });
  if (!order) return;

  const refundedCents = charge.amount_refunded;
  const fullyRefunded = refundedCents >= order.totalCents;

  await db.ticketOrder.update({
    where: { id: order.id },
    data: {
      refundedCents,
      refundedAt: new Date(),
      status: fullyRefunded
        ? TicketOrderStatus.REFUNDED
        : TicketOrderStatus.PARTIALLY_REFUNDED,
    },
  });

  // A refund taken straight from the Stripe dashboard still has to kill the
  // QR codes, otherwise a refunded ticket walks in the door.
  if (fullyRefunded) {
    for (const ticket of order.tickets) {
      await voidTicket({
        ticketId: ticket.id,
        reason: "Refunded in Stripe",
        status: TicketStatus.REFUNDED,
      });
    }
  }

  await logActivity({
    type: ActivityType.TICKET_ORDER_REFUNDED,
    action: `Refund of ${(refundedCents / 100).toFixed(2)} on order ${order.orderNumber}`,
    details: {
      orderId: order.id,
      refundedCents,
      fullyRefunded,
      source: "stripe-webhook",
    },
  });
}

async function handleDisputeOpened(dispute: Stripe.Dispute): Promise<void> {
  const chargeId =
    typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;

  const order = await db.ticketOrder.findFirst({
    where: { stripeChargeId: chargeId },
    select: { id: true, orderNumber: true, notes: true },
  });
  if (!order) return;

  // Flag it, but do not void the tickets: disputes get won, and cancelling
  // somebody's entry over a pending chargeback is the wrong default.
  await db.ticketOrder.update({
    where: { id: order.id },
    data: {
      notes: [order.notes, `Chargeback opened ${new Date().toISOString()}`]
        .filter(Boolean)
        .join("\n"),
    },
  });

  await logActivity({
    type: ActivityType.OTHER,
    action: `Chargeback opened on order ${order.orderNumber}`,
    details: { orderId: order.id, disputeId: dispute.id },
  });
}
