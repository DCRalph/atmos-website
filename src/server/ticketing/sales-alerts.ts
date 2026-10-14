import "server-only";

import { after } from "next/server";
import type { UserPermission } from "~Prisma/client";

import { env } from "~/env";
import { db } from "~/server/db";
import { publish } from "~/server/notify";
import { formatNZD } from "~/lib/ticketing/money";

/**
 * Push alerts to staff when an order is paid and when a tier sells out.
 *
 * Opt-in per person (`User.notifyTicketSales` / `notifyTierSoldOut`), and
 * delivered to whatever handsets that person has registered, so somebody with
 * no app install is opted in to nothing. The flags are only honoured while the
 * person is still staff: losing ADMIN quietly stops the alerts without anybody
 * having to remember to switch them off.
 */

/** Who may receive sales alerts. SUPERADMIN always comes with ADMIN. */
export const SALES_ALERT_PERMISSIONS = [
  "ADMIN",
  "EVENT_ORGANISER",
] as const satisfies UserPermission[];

export type SalesAlertKind = "notifyTicketSales" | "notifyTierSoldOut";

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
  const [sales, soldOut] = await Promise.all([
    recipients("notifyTicketSales"),
    soldOutTierIds.length > 0 ? recipients("notifyTierSoldOut") : [],
  ]);
  if (sales.length === 0 && soldOut.length === 0) return;

  const order = await db.ticketOrder.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      orderNumber: true,
      buyerName: true,
      totalCents: true,
      event: { select: { id: true, name: true } },
      items: { select: { quantity: true, tier: { select: { name: true } } } },
    },
  });
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

async function recipients(kind: SalesAlertKind): Promise<string[]> {
  const users = await db.user.findMany({
    where: {
      [kind]: true,
      permissions: {
        some: { permission: { in: [...SALES_ALERT_PERMISSIONS] } },
      },
    },
    select: { id: true },
  });
  return users.map((user) => user.id);
}
