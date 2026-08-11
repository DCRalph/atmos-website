import type { NextRequest } from "next/server";

import { db } from "~/server/db";
import { resolvePassTicket } from "~/server/wallet/pass-access";
import { buildApplePass } from "~/server/wallet/apple";
import { isAppleWalletConfigured } from "~/server/wallet/apple-config";

/**
 * Serves a signed `.pkpass` for one ticket.
 *
 * Authenticated by the order's access token, the same credential the buyer
 * already has in their email — they are a guest with no session, and the
 * wallet button has to work straight from a mail client.
 */

// Signing needs node crypto and sharp.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ ticketId: string }> },
): Promise<Response> {
  if (!isAppleWalletConfigured()) {
    return new Response("Apple Wallet is not configured", { status: 404 });
  }

  const { ticketId } = await ctx.params;
  const accessToken = request.nextUrl.searchParams.get("t");
  if (!accessToken) {
    return new Response("Missing token", { status: 401 });
  }

  // Scoped to whatever the token unlocks — an order, or a single comp ticket —
  // so one person's link can never mint a pass for somebody else's ticket.
  const resolved = await resolvePassTicket(ticketId, accessToken);
  if (!resolved) {
    return new Response("Not found", { status: 404 });
  }
  const { ticket, orderNumber } = resolved;

  try {
    const buffer = await buildApplePass({
      ticket,
      event: ticket.event,
      orderNumber,
    });

    await db.ticket
      .update({
        where: { id: ticket.id },
        data: { applePassSerial: ticket.id },
      })
      .catch(() => undefined);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${ticket.ticketNumber}.pkpass"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (cause) {
    console.error("[wallet] failed to build pkpass", cause);
    return new Response("Could not build pass", { status: 500 });
  }
}
