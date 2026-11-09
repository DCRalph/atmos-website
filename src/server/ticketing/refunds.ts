import "server-only";

import { TRPCError } from "@trpc/server";

import { TicketOrderStatus, TicketStatus } from "~Prisma/client";
import { db } from "~/server/db";
import { getStripe, isStripeConfigured } from "~/server/stripe";
import { voidTicket } from "~/server/ticketing/orders";
import { schedulePassUpdate } from "~/server/wallet/apple-push";

/**
 * Refund an order through Stripe and void every ticket still on it. The admin
 * "Refund order" button and a buyer taking a refund offer both end here.
 *
 * Stripe decides what is left to refund, so this never refunds more than was
 * taken: `amountCents` asks for less (an offer that keeps the booking fee),
 * and is capped at what Stripe still holds. `idempotencyKey` gets the amount
 * already refunded, so a doubled request is one refund.
 *
 * Throws a `TRPCError` when there is nothing to refund here.
 */
export async function refundOrderThroughStripe({
  orderId,
  amountCents,
  reason,
  idempotencyKey,
}: {
  orderId: string;
  /** Left out, everything Stripe still holds. */
  amountCents?: number;
  reason: string;
  idempotencyKey: (alreadyRefundedCents: number) => string;
}) {
  const order = await db.ticketOrder.findUnique({
    where: { id: orderId },
    include: {
      tickets: {
        where: { status: TicketStatus.VALID },
        select: { id: true, ticketNumber: true },
      },
    },
  });
  if (!order) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
  }
  if (!order.stripePaymentIntentId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This order wasn't paid through Stripe.",
    });
  }
  if (!isStripeConfigured()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Stripe isn't configured, so this can't be refunded here.",
    });
  }

  const stripe = getStripe();
  const intent = await stripe.paymentIntents.retrieve(
    order.stripePaymentIntentId,
    { expand: ["latest_charge"] },
  );
  const charge =
    typeof intent.latest_charge === "object" ? intent.latest_charge : null;
  const available = charge?.paid
    ? charge.amount_captured - charge.amount_refunded
    : 0;
  const amount = Math.min(amountCents ?? available, available);
  if (!charge || amount <= 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Stripe has nothing left to refund on this order.",
    });
  }

  await stripe.refunds.create(
    {
      charge: charge.id,
      amount,
      metadata: { orderId: order.id, reason },
    },
    { idempotencyKey: idempotencyKey(charge.amount_refunded) },
  );

  for (const ticket of order.tickets) {
    await voidTicket({
      ticketId: ticket.id,
      reason,
      status: TicketStatus.REFUNDED,
    });
    schedulePassUpdate(ticket.id);
  }

  // Stripe's running total, not an increment: the `charge.refunded` webhook
  // writes the same number and may land first.
  const refundedCents = charge.amount_refunded + amount;
  const updated = await db.ticketOrder.update({
    where: { id: order.id },
    data: {
      refundedCents,
      refundedAt: new Date(),
      status:
        refundedCents >= charge.amount_captured
          ? TicketOrderStatus.REFUNDED
          : TicketOrderStatus.PARTIALLY_REFUNDED,
    },
  });

  return {
    order: updated,
    amountCents: amount,
    ticketNumbers: order.tickets.map((ticket) => ticket.ticketNumber),
  };
}
