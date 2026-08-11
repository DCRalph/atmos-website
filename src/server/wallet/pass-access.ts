import "server-only";

import { TicketStatus } from "~Prisma/client";
import { db } from "~/server/db";
import {
  findOrderByAccessToken,
  findTicketByAccessToken,
} from "~/server/ticketing/orders";

/**
 * Who is allowed to build a wallet pass for a given ticket.
 *
 * Wallet buttons are opened straight from a mail client with no session, so the
 * only credential is the link the person already holds. That link is now one of
 * two things: an order token, which unlocks every ticket somebody bought, or a
 * ticket token, which unlocks exactly one. A comp recipient only ever has the
 * second kind, and scoping to that single ticket is what stops an artist
 * minting a pass for a ticket they were meant to hand on.
 */
export async function resolvePassTicket(
  ticketId: string,
  accessToken: string,
): Promise<{
  ticket: NonNullable<Awaited<ReturnType<typeof loadTicket>>>;
  orderNumber: string;
} | null> {
  const order = await findOrderByAccessToken(accessToken);
  if (order) {
    const ticket = await loadTicket({ id: ticketId, orderId: order.id });
    return ticket ? { ticket, orderNumber: order.orderNumber } : null;
  }

  const own = await findTicketByAccessToken(accessToken);
  // The token has to unlock this exact ticket, not merely some valid ticket.
  if (own?.id !== ticketId) return null;

  const ticket = await loadTicket({ id: ticketId });
  return ticket ? { ticket, orderNumber: own.order.orderNumber } : null;
}

function loadTicket(where: { id: string; orderId?: string }) {
  return db.ticket.findFirst({
    where: { ...where, status: TicketStatus.VALID },
    include: { tier: { select: { name: true } }, event: true },
  });
}
