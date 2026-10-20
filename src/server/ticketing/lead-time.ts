import { Prisma } from "~Prisma/client";

import { averagePace, type PaceRow } from "~/lib/ticketing/pace";
import { BOUGHT_ORDER } from "./order-sql";

/**
 * Sales by whole days before doors, per event: the rows under the analytics
 * page's "how far out they buy" and the pace line on an event's sales curve.
 *
 * `where` is over `ticket_event e`. Revenue is ticket
 * face value as paid, the same as the sales curve; comps count for nothing.
 */
export async function salesByDaysOut(
  db: Prisma.TransactionClient,
  where: Prisma.Sql,
) {
  return db.$queryRaw<(PaceRow & { orders: number })[]>`
    SELECT
      o."eventId" AS "eventId",
      floor(extract(epoch FROM (e."startsAt" - o."paidAt")) / 86400)::int AS days,
      COUNT(DISTINCT o.id)::int AS orders,
      COUNT(t.id)::int AS tickets,
      COALESCE(SUM(t."pricePaidCents"), 0)::int AS "revenueCents"
    FROM "ticket_order" o
    JOIN "ticket_event" e ON e.id = o."eventId"
    JOIN "ticket" t ON t."orderId" = o.id AND t."isComp" = false
    WHERE ${where} AND ${BOUGHT_ORDER}
    GROUP BY 1, 2
    UNION ALL
    SELECT
      e.id AS "eventId",
      0 AS days,
      0 AS orders,
      d."cashTickets" + d."eftposTickets" AS tickets,
      d."cashCents" + d."eftposCents" AS "revenueCents"
    FROM "event_door_totals" d
    JOIN "ticket_event" e ON e.id = d."eventId"
    WHERE ${where} AND (d."cashTickets" + d."eftposTickets") > 0
    ORDER BY 2 DESC
  `;
}

/**
 * The average past event's running total by days out, leaving out the event
 * being looked at. Drafts, cancelled events and events that sold nothing are
 * no guide, so they're left out too.
 */
export async function pastEventsPace(
  db: Prisma.TransactionClient,
  exceptEventId: string,
) {
  const rows = await salesByDaysOut(
    db,
    Prisma.sql`
      e."startsAt" < now()
      AND e.status NOT IN ('DRAFT', 'CANCELLED')
      AND e.id <> ${exceptEventId}
    `,
  );
  return averagePace(rows);
}
