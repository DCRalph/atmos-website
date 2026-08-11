import "server-only";

import { ActivityType, type PaymentMethodKind } from "~Prisma/client";
import { db } from "~/server/db";
import {
  createPendingOrder,
  issueTicketsForOrder,
  orderAccessToken,
} from "~/server/ticketing/orders";
import { sendTicketEmail } from "~/server/ticketing/email/send";
import { ticketsUrl } from "~/server/ticketing/urls";
import { logActivity } from "~/server/utils/activity-log";

/**
 * Selling a ticket to somebody standing in front of you.
 *
 * Runs through the same inventory and issuance path as an online sale, so
 * stock, scanning and analytics all stay consistent — the only difference is
 * where the money came from and that a staff member is named on it.
 *
 * Shared by the admin box office and the door, deliberately: two
 * implementations of "take cash and mint a ticket" would drift, and the one on
 * the door is the one running at midnight with a queue.
 */

/**
 * Money changed hands. Comps are not here: a giveaway is minted rather than
 * drawn from a tier, so it goes through `comps.ts` and never touches stock.
 */
export type BoxOfficePaymentMethod =
  typeof PaymentMethodKind.CASH | typeof PaymentMethodKind.TERMINAL;

export async function sellAtDoor({
  eventId,
  lines,
  paymentMethod,
  buyerName,
  buyerEmail,
  attendeeNames = [],
  notes,
  sendEmail = true,
  soldByUserId,
}: {
  eventId: string;
  lines: { tierId: string; quantity: number }[];
  paymentMethod: BoxOfficePaymentMethod;
  buyerName?: string | null;
  buyerEmail?: string | null;
  attendeeNames?: string[];
  notes?: string | null;
  sendEmail?: boolean;
  soldByUserId: string;
}): Promise<{
  orderId: string;
  orderNumber: string;
  ticketIds: string[];
  ticketCount: number;
  ticketsUrl: string;
}> {
  const order = await createPendingOrder({
    eventId,
    lines,
    ipAddress: null,
    // Accepted verbally at the door, by the staff member taking the money.
    termsAccepted: true,
    // Closed online sales don't stop a staff member taking cash at 11pm.
    boxOffice: true,
  });

  const issued = await issueTicketsForOrder({
    orderId: order.orderId,
    buyerEmail: buyerEmail ?? null,
    buyerName: buyerName ?? null,
    paymentMethod,
    soldByUserId,
  });

  if (notes) {
    await db.ticketOrder.update({
      where: { id: order.orderId },
      data: { notes },
    });
  }

  if (attendeeNames.length > 0) {
    const tickets = await db.ticket.findMany({
      where: { orderId: order.orderId },
      orderBy: { ticketNumber: "asc" },
      select: { id: true },
    });
    await db.$transaction(
      tickets
        .map((ticket, index) => ({ ticket, name: attendeeNames[index] }))
        .filter((entry) => Boolean(entry.name))
        .map((entry) =>
          db.ticket.update({
            where: { id: entry.ticket.id },
            data: { attendeeName: entry.name },
          }),
        ),
    );
  }

  await logActivity({
    type: ActivityType.BOX_OFFICE_SALE,
    action: `Box office ${paymentMethod.toLowerCase()} sale — ${issued.ticketIds.length} ticket(s)`,
    userId: soldByUserId,
    details: { orderId: order.orderId, eventId, paymentMethod },
  });

  if (sendEmail && buyerEmail) {
    await sendTicketEmail({ orderId: order.orderId });
  }

  const saved = await db.ticketOrder.findUniqueOrThrow({
    where: { id: order.orderId },
    select: { id: true, orderNumber: true, accessTokenVersion: true },
  });

  return {
    orderId: saved.id,
    orderNumber: saved.orderNumber,
    ticketIds: issued.ticketIds,
    ticketCount: issued.ticketIds.length,
    ticketsUrl: ticketsUrl(orderAccessToken(saved)),
  };
}
