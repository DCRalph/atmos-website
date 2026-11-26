import "server-only";

import type { ActivityType, Prisma } from "~Prisma/client";

import {
  API_UPDATE_TYPES,
  milestonesCrossed,
  UPDATE_RETENTION_DAYS,
  type ApiUpdateType,
} from "~/lib/developer/updates";
import { db } from "~/server/db";
import { updateFromActivity, type UpdateRow } from "./update-from-activity";

/**
 * Writing and reading the developer API's update feed (`ApiUpdate`).
 *
 * Most updates come from the activity log: `logActivity` hands every row to
 * `recordActivityUpdate`, so anything the admin, Will GPT or the API does is
 * in the feed without each of them remembering to put it there. Sales come
 * from the order issuance instead, which is the one place that knows an order
 * has just been paid and which tiers it emptied.
 *
 * Writing never throws: the feed is a convenience, the thing it describes has
 * already happened.
 */

export async function recordUpdate(row: UpdateRow): Promise<void> {
  try {
    let eventId = row.eventId ?? null;
    if (!eventId && row.orderId) {
      const order = await db.ticketOrder.findUnique({
        where: { id: row.orderId },
        select: { eventId: true },
      });
      eventId = order?.eventId ?? null;
    }
    await db.apiUpdate.create({
      data: {
        type: row.type,
        gigId: row.gigId ?? null,
        eventId,
        orderId: row.orderId ?? null,
        data: (row.data ?? {}) as Prisma.InputJsonObject,
      },
    });
  } catch (cause) {
    console.error("[developer-api] could not record update", {
      type: row.type,
      cause,
    });
  }
}

/** Called by `logActivity` for every row it writes. */
export async function recordActivityUpdate(
  type: ActivityType,
  details: Record<string, unknown> | undefined,
): Promise<void> {
  const row = updateFromActivity(type, details);
  if (row) await recordUpdate(row);
}

/**
 * `order.paid`, then `tier.sold_out` for each tier it emptied, then any
 * `sales.milestone` it carried the event past. Called once per order, from
 * the same place as the sales alerts.
 */
export async function recordOrderPaidUpdates(
  orderId: string,
  soldOutTierIds: string[],
): Promise<void> {
  const order = await db.ticketOrder.findUnique({
    where: { id: orderId },
    select: {
      eventId: true,
      totalCents: true,
      currency: true,
      paymentMethod: true,
      _count: { select: { tickets: true } },
      event: {
        select: {
          capacity: true,
          tiers: { select: { soldCount: true } },
        },
      },
    },
  });
  if (!order) return;

  const tickets = order._count.tickets;
  await recordUpdate({
    type: "order.paid",
    orderId,
    eventId: order.eventId,
    data: {
      tickets,
      totalCents: order.totalCents,
      currency: order.currency,
      paymentMethod: order.paymentMethod,
    },
  });

  if (soldOutTierIds.length > 0) {
    const tiers = await db.ticketTier.findMany({
      where: { id: { in: soldOutTierIds } },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    });
    for (const tier of tiers) {
      await recordUpdate({
        type: "tier.sold_out",
        eventId: order.eventId,
        data: { tierId: tier.id, name: tier.name },
      });
    }
  }

  // Against what the tiers have sold, the same count the event's cap is held
  // to. Comps are given away, so they are not a sales milestone.
  const capacity = order.event.capacity;
  if (capacity) {
    const sold = order.event.tiers.reduce(
      (sum, tier) => sum + tier.soldCount,
      0,
    );
    for (const percent of milestonesCrossed(sold - tickets, sold, capacity)) {
      await recordUpdate({
        type: "sales.milestone",
        eventId: order.eventId,
        data: { percent, sold, capacity },
      });
    }
  }
}

/**
 * Rows younger than this are held back from the feed. Ids are handed out when
 * a row is inserted, not when its transaction commits, so a just-written row
 * could still appear behind one already read. Two seconds is far longer than
 * any write here takes.
 */
const SETTLE_MS = 2_000;

/** Most updates in one page of the feed. */
export const MAX_UPDATES_PER_PAGE = 100;

/**
 * Updates after `after`, oldest first, of the types asked for that the key
 * may see. The cursor always comes back, so polling with it again is how a
 * client waits for more.
 */
export async function listUpdates(input: {
  /** `now` answers with no updates and the cursor of the latest one. */
  after: number | "now";
  types: ApiUpdateType[];
  eventId?: string;
  limit: number;
}) {
  if (input.after === "now") {
    const latest = await db.apiUpdate.findFirst({
      orderBy: { id: "desc" },
      select: { id: true },
    });
    return { data: [], nextCursor: String(latest?.id ?? 0) };
  }
  const rows = await db.apiUpdate.findMany({
    where: {
      id: { gt: input.after },
      type: { in: input.types },
      eventId: input.eventId,
      createdAt: { lt: new Date(Date.now() - SETTLE_MS) },
    },
    orderBy: { id: "asc" },
    take: input.limit,
  });
  return {
    data: rows.map((row) => ({
      id: `upd_${row.id}`,
      type: row.type as ApiUpdateType,
      createdAt: row.createdAt,
      gigId: row.gigId,
      eventId: row.eventId,
      orderId: row.orderId,
      data: row.data as Record<string, unknown>,
    })),
    nextCursor: String(rows.at(-1)?.id ?? input.after),
  };
}

/** The feed's types this key's scopes let it see. */
export function visibleUpdateTypes(
  has: (scope: (typeof API_UPDATE_TYPES)[ApiUpdateType]["scope"]) => boolean,
): ApiUpdateType[] {
  return (Object.keys(API_UPDATE_TYPES) as ApiUpdateType[]).filter((type) =>
    has(API_UPDATE_TYPES[type].scope),
  );
}

/** Drops updates past the retention window. Run by the ticketing sweep. */
export async function pruneUpdates(): Promise<number> {
  const { count } = await db.apiUpdate.deleteMany({
    where: {
      createdAt: {
        lt: new Date(Date.now() - UPDATE_RETENTION_DAYS * 24 * 60 * 60 * 1000),
      },
    },
  });
  return count;
}
