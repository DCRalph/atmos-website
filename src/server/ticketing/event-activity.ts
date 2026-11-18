import {
  ActivityType,
  PaymentMethodKind,
  Prisma,
  type TicketScanResult,
} from "~Prisma/client";
import { db } from "~/server/db";
import {
  decodeActivityCursor,
  mergeActivityPage,
  type ActivityCursor,
  type ActivityKind,
} from "~/lib/ticketing/event-activity";

/**
 * Everything that happened on one event, newest first, for the Activity
 * section of the event page. Three sources:
 *
 * - paid orders, from the orders themselves (a door sale writes no log)
 * - scans, from the scan log (every door action is a row there)
 * - the activity log, for refunds and anything an admin changed
 *
 * The log names its event in different ways depending on who wrote it: an
 * `eventId`, an `orderId`, a `ticketId`, an `offerId`, a `campaignId` or a
 * list of `orderIds`.
 * All of them are resolved here, so a refund logged by the Stripe webhook with
 * only an order id still lands on its event.
 */

/** Already a row in another source, or only a duplicate of one. */
const SHOWN_ELSEWHERE = [
  ActivityType.TICKET_ORDER_PAID,
  ActivityType.BOX_OFFICE_SALE,
  ActivityType.TICKET_SCAN_OVERRIDE,
  ActivityType.TICKET_ENTRY_DENIED,
];

const REFUND_TYPES = [
  ActivityType.TICKET_ORDER_REFUNDED,
  ActivityType.REFUND_OFFERED,
  ActivityType.REFUND_OFFER_WITHDRAWN,
];

/** Logged as the comp, link batch or first scan that made them instead. */
const NOT_SALES = [
  PaymentMethodKind.COMP,
  PaymentMethodKind.ADMIN,
  PaymentMethodKind.LIFETIME,
];

type Base = ActivityCursor & { by: string | null };

export type EventActivityItem =
  | (Base & {
      kind: "sales";
      orderId: string;
      orderNumber: string;
      buyerName: string | null;
      totalCents: number;
      tickets: number;
      paymentMethod: PaymentMethodKind;
    })
  | (Base & {
      kind: "door";
      result: TicketScanResult;
      ticketNumber: string | null;
      attendeeName: string | null;
      denyReason: string | null;
      note: string | null;
      deviceLabel: string | null;
    })
  | (Base & {
      kind: "refunds" | "changes";
      action: string;
    });

export async function eventActivity(input: {
  eventId: string;
  kind?: ActivityKind;
  cursor?: string;
  limit: number;
}) {
  const { eventId, kind, limit } = input;
  const cursor = decodeActivityCursor(input.cursor);
  const wants = (k: ActivityKind) => !kind || kind === k;

  const [orders, scans, logs] = await Promise.all([
    wants("sales") ? paidOrders(eventId, cursor, limit) : [],
    wants("door") ? scansOf(eventId, cursor, limit) : [],
    wants("refunds") || wants("changes")
      ? logsOf(eventId, cursor, limit, kind)
      : [],
  ]);

  const userIds = new Set<string>();
  for (const order of orders) {
    if (order.soldByUserId) userIds.add(order.soldByUserId);
  }
  for (const scan of scans) {
    if (scan.scannedByUserId) userIds.add(scan.scannedByUserId);
  }
  for (const log of logs) if (log.userId) userIds.add(log.userId);
  const users = await db.user.findMany({
    where: { id: { in: [...userIds] } },
    select: { id: true, name: true },
  });
  const nameOf = new Map(users.map((user) => [user.id, user.name]));
  const by = (userId: string | null) =>
    userId ? (nameOf.get(userId) ?? null) : null;

  return mergeActivityPage<EventActivityItem>(
    [
      orders.map((order) => ({
        kind: "sales" as const,
        at: order.paidAt,
        id: order.id,
        by: by(order.soldByUserId),
        orderId: order.id,
        orderNumber: order.orderNumber,
        buyerName: order.buyerName,
        totalCents: order.totalCents,
        tickets: order._count.tickets,
        paymentMethod: order.paymentMethod,
      })),
      scans.map((scan) => ({
        kind: "door" as const,
        at: scan.createdAt,
        id: scan.id,
        by: by(scan.scannedByUserId),
        result: scan.result,
        ticketNumber: scan.ticket?.ticketNumber ?? null,
        attendeeName: scan.ticket?.attendeeName ?? null,
        denyReason: scan.denyReason,
        note: scan.denyNote,
        deviceLabel: scan.deviceLabel,
      })),
      logs.map((log) => ({
        kind: REFUND_TYPES.some((type) => type === log.type)
          ? ("refunds" as const)
          : ("changes" as const),
        at: log.createdAt,
        id: log.id,
        by: by(log.userId),
        action: log.action,
      })),
    ],
    limit,
  );
}

async function paidOrders(
  eventId: string,
  cursor: ActivityCursor | null,
  limit: number,
) {
  const orders = await db.ticketOrder.findMany({
    where: {
      eventId,
      paidAt: { not: null },
      paymentMethod: { notIn: NOT_SALES },
      ...(cursor
        ? {
            OR: [
              { paidAt: { lt: cursor.at } },
              { paidAt: cursor.at, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ paidAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      orderNumber: true,
      buyerName: true,
      totalCents: true,
      paymentMethod: true,
      paidAt: true,
      soldByUserId: true,
      _count: { select: { tickets: true } },
    },
  });
  // The where clause already ruled out a null.
  return orders.flatMap((order) =>
    order.paidAt ? [{ ...order, paidAt: order.paidAt }] : [],
  );
}

function scansOf(
  eventId: string,
  cursor: ActivityCursor | null,
  limit: number,
) {
  return db.ticketScan.findMany({
    where: {
      eventId,
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.at } },
              { createdAt: cursor.at, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      result: true,
      createdAt: true,
      scannedByUserId: true,
      deviceLabel: true,
      denyReason: true,
      denyNote: true,
      ticket: { select: { ticketNumber: true, attendeeName: true } },
    },
  });
}

function logsOf(
  eventId: string,
  cursor: ActivityCursor | null,
  limit: number,
  kind: ActivityKind | undefined,
) {
  const refunds = Prisma.join(REFUND_TYPES);
  const ofKind =
    kind === "refunds"
      ? Prisma.sql`AND l.type::text IN (${refunds})`
      : kind === "changes"
        ? Prisma.sql`AND l.type::text NOT IN (${refunds})`
        : Prisma.empty;
  const before = cursor
    ? Prisma.sql`AND (l."createdAt", l.id) < (${cursor.at}, ${cursor.id})`
    : Prisma.empty;

  // `details` is text written with JSON.stringify, which can still produce
  // something jsonb refuses (a \u0000). That row is skipped, not fatal.
  return db.$queryRaw<
    {
      id: string;
      type: ActivityType;
      action: string;
      userId: string | null;
      createdAt: Date;
    }[]
  >`
    WITH orders AS (SELECT id FROM ticket_order WHERE "eventId" = ${eventId})
    SELECT l.id, l.type::text AS type, l.action, l."userId", l."createdAt"
    FROM activity_log l
    CROSS JOIN LATERAL (
      SELECT CASE WHEN pg_input_is_valid(l.details, 'jsonb')
        THEN l.details::jsonb END AS d
    ) j
    WHERE l.details IS NOT NULL
      AND l.type::text NOT IN (${Prisma.join(SHOWN_ELSEWHERE)})
      ${ofKind}
      ${before}
      AND (
        j.d ->> 'eventId' = ${eventId}
        OR j.d ->> 'orderId' IN (SELECT id FROM orders)
        OR j.d ->> 'ticketId' IN (SELECT id FROM ticket WHERE "eventId" = ${eventId})
        OR j.d ->> 'campaignId' IN (SELECT id FROM campaign WHERE "eventId" = ${eventId})
        OR j.d ->> 'offerId' IN (
          SELECT r.id FROM refund_offer r WHERE r."orderId" IN (SELECT id FROM orders)
        )
        OR (
          jsonb_typeof(j.d -> 'orderIds') = 'array'
          AND j.d -> 'orderIds' ?| ARRAY(SELECT id FROM orders)
        )
      )
    ORDER BY l."createdAt" DESC, l.id DESC
    LIMIT ${limit}
  `;
}
