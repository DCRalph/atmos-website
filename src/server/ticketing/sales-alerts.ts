import "server-only";

import { after } from "next/server";
import type { Prisma } from "~Prisma/client";

import { env } from "~/env";
import { db } from "~/server/db";
import { publish } from "~/server/notify";
import { formatNZD } from "~/lib/ticketing/money";

/**
 * Push alerts to staff when an order is paid and when a tier sells out.
 *
 * Opt-in per event and per person (`TicketEventSalesAlert`), delivered to
 * whatever handsets that person has registered, so somebody with no app
 * install is opted in to nothing. Only honoured while the person can still
 * see the event's sales: an admin, or one of the event's managers. Losing that
 * quietly stops the alerts without anybody having to switch them off.
 */

export type SalesAlertKind = "orders" | "soldOut";

/**
 * Who may get alerts for an event: every admin, and the event's door staff
 * with the manager role. Also the filter the sender applies, so a stale
 * opt-in from somebody who has since lost access goes nowhere.
 */
export async function salesAlertEligible(
  eventId: string,
): Promise<Prisma.UserWhereInput> {
  const managers = await db.ticketEventStaff.findMany({
    where: { eventId, role: "MANAGER" },
    select: { userId: true },
  });
  return {
    OR: [
      {
        permissions: {
          some: { permission: { in: ["ADMIN", "SUPERADMIN"] } },
        },
      },
      { id: { in: managers.map((manager) => manager.userId) } },
    ],
  };
}

/**
 * Alert opted-in staff about a freshly paid order, after the response is sent.
 *
 * Called once per order, by the issuance that claimed it. Never throws and
 * never delays the buyer: the order is paid whether or not this goes out.
 */
export function scheduleSalesAlerts(orderId: string, soldOutTierIds: string[]) {
  const task = () =>
    sendSalesAlerts(orderId, soldOutTierIds).catch((cause: unknown) => {
      console.error("[sales-alerts] failed", { orderId, cause });
    });
  try {
    after(task);
  } catch {
    // Outside a request (a script, the test runner): just run it.
    void task();
  }
}

async function sendSalesAlerts(orderId: string, soldOutTierIds: string[]) {
  const order = await db.ticketOrder.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      eventId: true,
      orderNumber: true,
      buyerName: true,
      totalCents: true,
      event: { select: { id: true, name: true } },
      items: { select: { quantity: true, tier: { select: { name: true } } } },
    },
  });
  const [sales, soldOut] = await Promise.all([
    recipients(order.eventId, "orders"),
    soldOutTierIds.length > 0 ? recipients(order.eventId, "soldOut") : [],
  ]);
  if (sales.length === 0 && soldOut.length === 0) return;

  const click = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/admin/events/${order.event.id}`;

  if (sales.length > 0) {
    const lines = order.items
      .map((item) => `${item.quantity}× ${item.tier.name}`)
      .join(", ");
    await publish(
      {
        topic: "sales",
        title: order.event.name,
        message: `${order.buyerName ?? `Order ${order.orderNumber}`}: ${lines} · ${
          order.totalCents > 0 ? formatNZD(order.totalCents) : "Free"
        }`,
        priority: 3,
        tags: [],
        click,
      },
      { source: "ticketing", audience: { kind: "users", userIds: sales } },
    );
  }

  if (soldOut.length > 0) {
    const tiers = await db.ticketTier.findMany({
      where: { id: { in: soldOutTierIds } },
      select: { name: true },
      orderBy: { sortOrder: "asc" },
    });
    await publish(
      {
        topic: "sold-out",
        title: `Sold out: ${tiers.map((tier) => tier.name).join(", ")}`,
        message: order.event.name,
        priority: 4,
        tags: [],
        click,
      },
      { source: "ticketing", audience: { kind: "users", userIds: soldOut } },
    );
  }
}

async function recipients(
  eventId: string,
  kind: SalesAlertKind,
): Promise<string[]> {
  const rows = await db.ticketEventSalesAlert.findMany({
    where: {
      eventId,
      [kind]: true,
      user: await salesAlertEligible(eventId),
    },
    select: { userId: true },
  });
  return rows.map((row) => row.userId);
}
