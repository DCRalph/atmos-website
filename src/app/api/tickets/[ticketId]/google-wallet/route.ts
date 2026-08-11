import type { NextRequest } from "next/server";

import { TicketStatus } from "~Prisma/client";
import { db } from "~/server/db";
import { findOrderByAccessToken } from "~/server/ticketing/orders";
import { buildGoogleWalletSaveUrl } from "~/server/wallet/google";
import { isGoogleWalletConfigured } from "~/server/wallet/google-config";

/**
 * Redirects to a signed Google Wallet save link.
 *
 * The JWT goes in a redirect rather than straight into the email so the token
 * is minted fresh on click — an attendee name added after the email went out
 * still shows up on the pass.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ ticketId: string }> },
): Promise<Response> {
  if (!isGoogleWalletConfigured()) {
    return new Response("Google Wallet is not configured", { status: 404 });
  }

  const { ticketId } = await ctx.params;
  const accessToken = request.nextUrl.searchParams.get("t");
  if (!accessToken) {
    return new Response("Missing token", { status: 401 });
  }

  const order = await findOrderByAccessToken(accessToken);
  if (!order) return new Response("Not found", { status: 404 });

  const ticket = await db.ticket.findFirst({
    where: { id: ticketId, orderId: order.id, status: TicketStatus.VALID },
    include: { tier: { select: { name: true } }, event: true },
  });
  if (!ticket) return new Response("Not found", { status: 404 });

  try {
    const url = await buildGoogleWalletSaveUrl({
      ticket,
      event: ticket.event,
      orderNumber: order.orderNumber,
    });
    if (!url) return new Response("Not found", { status: 404 });

    await db.ticket
      .update({
        where: { id: ticket.id },
        data: { googleObjectId: ticket.id },
      })
      .catch(() => undefined);

    return Response.redirect(url, 302);
  } catch (cause) {
    console.error("[wallet] failed to build Google Wallet link", cause);
    return new Response("Could not build pass", { status: 500 });
  }
}
