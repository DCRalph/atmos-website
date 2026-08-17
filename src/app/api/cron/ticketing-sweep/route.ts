import type { NextRequest } from "next/server";

import {
  PaymentMethodKind,
  TicketOrderStatus,
  TicketStatus,
} from "~Prisma/client";
import { env } from "~/env";
import { db } from "~/server/db";
import { getStripe, isStripeConfigured } from "~/server/stripe";
import {
  issueTicketsForOrder,
  syncMarketingConsent,
} from "~/server/ticketing/orders";
import { sendTicketEmail } from "~/server/ticketing/email/send";
import {
  releaseExpiredHolds,
  withEventInventoryLock,
} from "~/server/ticketing/inventory";
import { pruneRateLimitKeys } from "~/server/ticketing/rate-limit";
import { purgeExpiredPatrons } from "~/server/ticketing/id-check";

/**
 * The ticketing janitor. Runs every few minutes (see `vercel.json`).
 *
 * Four jobs, in order of how much they matter:
 *
 *  1. **Reconcile paid-but-unissued orders.** Webhooks get lost. If Stripe says
 *     a PaymentIntent succeeded and we still have a PENDING order, that is
 *     somebody who paid and has no ticket — fix it and email them.
 *  2. **Release expired holds.** Checkouts get abandoned. Availability sweeps
 *     itself lazily on every purchase, but a dead-quiet event needs this so
 *     stock isn't held hostage by an abandoned tab.
 *  3. **Purge expired patron records.** Names, birthdays and faces read off ID
 *     documents at the door, deleted once their window is up. This is the job
 *     that makes the ID system defensible, so it runs here rather than being
 *     something somebody remembers to do.
 *  4. **Prune rate-limit rows**, which are write-once and never read again.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
  const authorized =
    !env.CRON_SECRET ||
    request.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
  if (!authorized) {
    return new Response("Unauthorized", { status: 401 });
  }

  const rescued = await reconcileUnissuedOrders();
  const expired = await releaseAllExpiredHolds();
  const purgedPatrons = await purgeExpiredPatrons();
  const pruned = await pruneRateLimitKeys();

  return Response.json({ rescued, expired, purgedPatrons, pruned });
}

/**
 * Orders where Stripe took the money but we never issued a ticket. Bounded to
 * a recent window and a small batch so one invocation can't run long.
 */
async function reconcileUnissuedOrders(): Promise<number> {
  if (!isStripeConfigured()) return 0;

  const candidates = await db.ticketOrder.findMany({
    where: {
      status: TicketOrderStatus.PENDING,
      stripePaymentIntentId: { not: null },
      createdAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true, stripePaymentIntentId: true },
    take: 25,
  });

  const stripe = getStripe();
  let rescued = 0;

  for (const order of candidates) {
    if (!order.stripePaymentIntentId) continue;

    try {
      const intent = await stripe.paymentIntents.retrieve(
        order.stripePaymentIntentId,
        { expand: ["latest_charge"] },
      );
      if (intent.status !== "succeeded") continue;

      const charge =
        typeof intent.latest_charge === "object" ? intent.latest_charge : null;

      const result = await issueTicketsForOrder({
        orderId: order.id,
        buyerEmail:
          intent.receipt_email ?? charge?.billing_details?.email ?? null,
        buyerName: charge?.billing_details?.name ?? null,
        paymentIntentId: intent.id,
        chargeId: charge?.id ?? null,
        paymentMethod: PaymentMethodKind.STRIPE,
      });

      if (!result.alreadyIssued) {
        await syncMarketingConsent(order.id);
        await sendTicketEmail({ orderId: order.id });
        rescued += 1;
        console.warn(
          `[ticketing] rescued order ${order.id} — webhook never arrived`,
        );
      }
    } catch (cause) {
      console.error(`[ticketing] reconcile failed for ${order.id}`, cause);
    }
  }

  return rescued;
}

/** Expire stale holds on every event that has any. */
async function releaseAllExpiredHolds(): Promise<number> {
  const stale = await db.ticketOrder.findMany({
    where: {
      status: TicketOrderStatus.PENDING,
      expiresAt: { lt: new Date() },
    },
    select: { eventId: true },
    distinct: ["eventId"],
    take: 50,
  });

  let total = 0;
  for (const { eventId } of stale) {
    // The lock helper sweeps on entry, so the body has nothing left to do.
    total += await withEventInventoryLock(eventId, (tx) =>
      releaseExpiredHolds(tx, eventId),
    );
  }
  return total;
}

/**
 * Recompute `soldCount` from the ticket table and report drift.
 *
 * Not part of the regular sweep — it is a consistency check to run by hand (or
 * nightly) if the denormalised counters are ever suspected of being wrong.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const authorized =
    !env.CRON_SECRET ||
    request.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
  if (!authorized) return new Response("Unauthorized", { status: 401 });

  const tiers = await db.ticketTier.findMany({
    select: { id: true, eventId: true, soldCount: true },
  });

  const drift: { tierId: string; stored: number; actual: number }[] = [];

  for (const tier of tiers) {
    const actual = await db.ticket.count({
      where: { tierId: tier.id, status: TicketStatus.VALID },
    });
    if (actual !== tier.soldCount) {
      drift.push({ tierId: tier.id, stored: tier.soldCount, actual });
      await withEventInventoryLock(tier.eventId, async (tx) => {
        await tx.ticketTier.update({
          where: { id: tier.id },
          data: { soldCount: actual },
        });
      });
    }
  }

  if (drift.length > 0) {
    console.error("[ticketing] tier counter drift corrected", drift);
  }

  const compDrift = await checkCompAccounting();

  return Response.json({
    checked: tiers.length,
    corrected: drift,
    compDrift,
  });
}

/**
 * Assert the identity that makes comp numbers readable:
 *
 *     valid tickets = Σ tier soldCount + comps
 *
 * Comps are minted outside every tier counter, so if this ever fails it means
 * a ticket exists that is neither drawn from a tier nor marked as a comp — the
 * one shape that would quietly make the admin figures stop adding up. Reported
 * rather than corrected, because there is no way to know from here which half
 * is wrong.
 */
async function checkCompAccounting(): Promise<
  { eventId: string; tickets: number; fromTiers: number; comps: number }[]
> {
  const events = await db.ticketEvent.findMany({
    select: {
      id: true,
      tiers: { select: { soldCount: true } },
      _count: {
        select: { tickets: { where: { status: TicketStatus.VALID } } },
      },
    },
  });

  const drift: {
    eventId: string;
    tickets: number;
    fromTiers: number;
    comps: number;
  }[] = [];

  for (const event of events) {
    const comps = await db.ticket.count({
      where: { eventId: event.id, isComp: true, status: TicketStatus.VALID },
    });
    const fromTiers = event.tiers.reduce((sum, t) => sum + t.soldCount, 0);

    if (fromTiers + comps !== event._count.tickets) {
      drift.push({
        eventId: event.id,
        tickets: event._count.tickets,
        fromTiers,
        comps,
      });
    }
  }

  if (drift.length > 0) {
    console.error("[ticketing] comp accounting does not reconcile", drift);
  }

  return drift;
}
