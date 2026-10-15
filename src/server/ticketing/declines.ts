import "server-only";

import type { Prisma } from "~Prisma/client";
import {
  classifyDecline,
  summariseDeclines,
  type Decline,
  type PaymentCard,
} from "~/lib/ticketing/declines";
import { BOUGHT_ORDER } from "./order-sql";

/**
 * Declined payments, read from `ticket_payment_attempt`. The analytics page
 * (every event in scope), the event dashboard (one event), the order dialog
 * and the orders list (a few orders) all go through `declinedOrders`, which
 * takes its filter as SQL over `ticket_event e` and `ticket_order o`.
 */

type RawDecline = {
  orderId: string;
  orderNumber: string;
  eventId: string;
  status: string;
  buyerName: string | null;
  email: string | null;
  totalCents: number;
  paidAt: Date | null;
  declinedAt: Date;
  reason: string | null;
  declinedWith: string | null;
  declinedBrand: string | null;
  declinedLast4: string | null;
  acceptedAt: Date | null;
  acceptedWith: string | null;
  acceptedBrand: string | null;
  acceptedLast4: string | null;
  nextId: string | null;
  nextOrderNumber: string | null;
  nextPaidAt: Date | null;
  nextWith: string | null;
  nextBrand: string | null;
  nextLast4: string | null;
};

/**
 * Every order with at least one declined try, newest decline first, with
 * what came of it. A buyer who started again is matched to their next paid
 * order for the same event by browser visit or by email: the declined order
 * has no buyer email of its own, but the card's billing email usually does.
 */
export async function declinedOrders(
  db: Prisma.TransactionClient,
  where: Prisma.Sql,
): Promise<Decline[]> {
  const rows = await db.$queryRaw<RawDecline[]>`
    WITH d AS (
      SELECT
        o.id, o."orderNumber", o."eventId", o.status::text AS status,
        o."visitId", o."buyerName", o."buyerEmail", o."totalCents", o."paidAt",
        MIN(a."attemptedAt") AS declined_at,
        array_agg(DISTINCT a.email) FILTER (WHERE a.email IS NOT NULL) AS emails
      FROM "ticket_event" e
      JOIN "ticket_order" o ON o."eventId" = e.id
      JOIN "ticket_payment_attempt" a ON a."orderId" = o.id AND a.status = 'FAILED'
      WHERE ${where}
      GROUP BY o.id
    )
    SELECT
      d.id AS "orderId", d."orderNumber", d."eventId", d.status,
      d."buyerName", COALESCE(d."buyerEmail", f.email) AS email,
      d."totalCents", d."paidAt", d.declined_at AS "declinedAt",
      COALESCE(f."declineReason", f."failureCode") AS reason,
      f."paidWith" AS "declinedWith", f."cardBrand" AS "declinedBrand",
      f."cardLast4" AS "declinedLast4",
      s."attemptedAt" AS "acceptedAt", s."paidWith" AS "acceptedWith",
      s."cardBrand" AS "acceptedBrand", s."cardLast4" AS "acceptedLast4",
      n.id AS "nextId", n."orderNumber" AS "nextOrderNumber",
      n."paidAt" AS "nextPaidAt", na."paidWith" AS "nextWith",
      na."cardBrand" AS "nextBrand", na."cardLast4" AS "nextLast4"
    FROM d
    JOIN LATERAL (
      SELECT * FROM "ticket_payment_attempt" a
      WHERE a."orderId" = d.id AND a.status = 'FAILED'
      ORDER BY a."attemptedAt" DESC LIMIT 1
    ) f ON true
    LEFT JOIN LATERAL (
      SELECT * FROM "ticket_payment_attempt" a
      WHERE a."orderId" = d.id AND a.status = 'SUCCEEDED'
      ORDER BY a."attemptedAt" LIMIT 1
    ) s ON true
    LEFT JOIN LATERAL (
      SELECT o.id, o."orderNumber", o."paidAt"
      FROM "ticket_order" o
      WHERE s.id IS NULL
        AND o."eventId" = d."eventId"
        AND o.id <> d.id
        AND o."paidAt" > d.declined_at
        AND ${BOUGHT_ORDER}
        AND (
          o."visitId" = d."visitId"
          OR lower(o."buyerEmail") = ANY(d.emails)
          OR lower(o."buyerEmail") = lower(d."buyerEmail")
        )
      ORDER BY o."paidAt" LIMIT 1
    ) n ON true
    LEFT JOIN LATERAL (
      SELECT * FROM "ticket_payment_attempt" a
      WHERE a."orderId" = n.id AND a.status = 'SUCCEEDED'
      ORDER BY a."attemptedAt" LIMIT 1
    ) na ON true
    ORDER BY d.declined_at DESC
  `;

  const card = (
    paidWith: string | null,
    cardBrand: string | null,
    cardLast4: string | null,
  ): PaymentCard => ({ paidWith, cardBrand, cardLast4 });

  return rows.map((row) =>
    classifyDecline({
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      eventId: row.eventId,
      status: row.status,
      buyerName: row.buyerName,
      email: row.email,
      totalCents: row.totalCents,
      paidAt: row.paidAt,
      declinedAt: row.declinedAt,
      reason: row.reason,
      declined: card(row.declinedWith, row.declinedBrand, row.declinedLast4),
      accepted: row.acceptedAt
        ? {
            at: row.acceptedAt,
            ...card(row.acceptedWith, row.acceptedBrand, row.acceptedLast4),
          }
        : null,
      next:
        row.nextId && row.nextOrderNumber && row.nextPaidAt
          ? {
              id: row.nextId,
              orderNumber: row.nextOrderNumber,
              paidAt: row.nextPaidAt,
              ...card(row.nextWith, row.nextBrand, row.nextLast4),
            }
          : null,
    }),
  );
}

/**
 * Orders Stripe took money for that were let go without tickets. A payment
 * that lands after the order lapsed is issued or refunded straight away now,
 * so anything here needs a person: refund it or issue the tickets.
 */
export async function paidWithoutTickets(
  db: Prisma.TransactionClient,
  where: Prisma.Sql,
) {
  return db.$queryRaw<
    {
      orderId: string;
      orderNumber: string;
      eventId: string;
      amountCents: number;
    }[]
  >`
    SELECT o.id AS "orderId", o."orderNumber", o."eventId",
      SUM(a."amountCents")::int AS "amountCents"
    FROM "ticket_event" e
    JOIN "ticket_order" o ON o."eventId" = e.id
    JOIN "ticket_payment_attempt" a ON a."orderId" = o.id AND a.status = 'SUCCEEDED'
    WHERE ${where} AND o.status IN ('FAILED', 'EXPIRED', 'CANCELLED')
    GROUP BY o.id
    ORDER BY MIN(a."attemptedAt") DESC
  `;
}

/**
 * The declined payments card: the headline, the latest declines, and how
 * many tries there were to be declined. `scope` is over `ticket_event e`.
 */
export async function declineReport(
  db: Prisma.TransactionClient,
  scope: Prisma.Sql,
) {
  const [declines, [tries], stranded] = await Promise.all([
    declinedOrders(db, scope),
    db.$queryRaw<{ orders: number; tries: number; accepted: number }[]>`
      SELECT
        COUNT(DISTINCT a."orderId")::int AS orders,
        COUNT(*)::int AS tries,
        COUNT(*) FILTER (WHERE a.status = 'SUCCEEDED')::int AS accepted
      FROM "ticket_event" e
      JOIN "ticket_order" o ON o."eventId" = e.id
      JOIN "ticket_payment_attempt" a ON a."orderId" = o.id
      WHERE ${scope}
    `,
    paidWithoutTickets(db, scope),
  ]);

  return {
    /** Orders somebody tried to pay for. */
    orders: tries?.orders ?? 0,
    tries: tries?.tries ?? 0,
    accepted: tries?.accepted ?? 0,
    summary: summariseDeclines(declines),
    recent: declines.slice(0, 8),
    stranded,
  };
}

export type DeclineReport = Awaited<ReturnType<typeof declineReport>>;
