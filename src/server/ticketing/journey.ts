import type { Prisma } from "~Prisma/client";

import { BOUGHT_ORDER, ONLINE_ORDER, VISIT } from "./order-sql";

/**
 * The checkout journey: how many visits reach each checkpoint, and how long
 * the typical one takes between them. Shared by the analytics page (every
 * event in scope) and the event dashboard (one event).
 *
 * Checkpoints, and where each is written:
 *  - saw the page:    `ticket_event_view.createdAt`, by the page
 *  - added a ticket:  `ticket_event_view.firstAddedAt`, by the buy panel
 *  - hold and pay:    the visit's first `ticket_order.createdAt`
 *  - paid:            `ticket_order.paidAt`
 *  - named tickets:   `ticket_order.detailsCompletedAt`
 *
 * It stops there: the door is days or weeks later and is its own measure.
 *
 * Views only started being counted on 15 Oct 2026, so earlier checkouts have
 * no view behind them; the counts are taken from each source rather than
 * only from visits that have a view, and the page says so when it shows.
 */
export type CheckoutJourney = {
  viewed: number;
  added: number;
  held: number;
  paid: number;
  named: number;
  /** Median seconds from the checkpoint before, null without data. */
  seconds: {
    toAdd: number | null;
    toHold: number | null;
    toPay: number | null;
    toName: number | null;
  };
};

/** `scope` is over `ticket_event e`. */
export async function checkoutJourney(
  db: Prisma.TransactionClient,
  scope: Prisma.Sql,
): Promise<CheckoutJourney> {
  const [[views], [orders]] = await Promise.all([
    // From the page: visits, the ones that added a ticket, how long that
    // took, and how long from there to the first hold.
    db.$queryRaw<
      {
        viewed: number;
        added: number;
        toAdd: number | null;
        toHold: number | null;
      }[]
    >`
      SELECT
        COUNT(*)::int AS viewed,
        COUNT(v."firstAddedAt")::int AS added,
        (percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (v."firstAddedAt" - v."createdAt")))
          FILTER (WHERE v."firstAddedAt" IS NOT NULL))::float AS "toAdd",
        (percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (h.held_at - v."firstAddedAt")))
          FILTER (WHERE v."firstAddedAt" IS NOT NULL AND h.held_at >= v."firstAddedAt"))::float AS "toHold"
      FROM "ticket_event" e
      JOIN "ticket_event_view" v ON v."eventId" = e.id
      LEFT JOIN LATERAL (
        SELECT MIN(o."createdAt") AS held_at
        FROM "ticket_order" o
        WHERE o."eventId" = v."eventId"
          AND o."visitId" = v."visitId"
          AND ${ONLINE_ORDER}
      ) h ON true
      WHERE ${scope}
    `,
    // From the orders: one journey per visit per event, from its first hold.
    // Names can be given before paying, in which case naming took no time
    // after payment and is left out of the median.
    db.$queryRaw<
      {
        held: number;
        paid: number;
        named: number;
        toPay: number | null;
        toName: number | null;
      }[]
    >`
      SELECT
        COUNT(*)::int AS held,
        COUNT(j.paid_at)::int AS paid,
        COUNT(j.named_at)::int AS named,
        (percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (j.paid_at - j.held_at)))
          FILTER (WHERE j.paid_at IS NOT NULL))::float AS "toPay",
        (percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (j.named_at - j.paid_at)))
          FILTER (WHERE j.named_at > j.paid_at))::float AS "toName"
      FROM (
        SELECT
          MIN(o."createdAt") AS held_at,
          MIN(o."paidAt") FILTER (WHERE ${BOUGHT_ORDER}) AS paid_at,
          MIN(o."detailsCompletedAt") FILTER (WHERE ${BOUGHT_ORDER}) AS named_at
        FROM "ticket_event" e
        JOIN "ticket_order" o ON o."eventId" = e.id
        WHERE ${scope} AND ${ONLINE_ORDER}
        GROUP BY o."eventId", ${VISIT}
      ) j
    `,
  ]);

  return {
    viewed: views?.viewed ?? 0,
    added: views?.added ?? 0,
    held: orders?.held ?? 0,
    paid: orders?.paid ?? 0,
    named: orders?.named ?? 0,
    seconds: {
      toAdd: views?.toAdd ?? null,
      toHold: views?.toHold ?? null,
      toPay: orders?.toPay ?? null,
      toName: orders?.toName ?? null,
    },
  };
}
