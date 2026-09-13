import type { NextRequest } from "next/server";

import { findLifetimeByAccessToken } from "~/server/ticketing/lifetime";
import { buildLifetimePass } from "~/server/wallet/apple-lifetime";
import { isAppleWalletConfigured } from "~/server/wallet/apple-config";

/**
 * Serves a signed `.pkpass` for one lifetime pass.
 *
 * Authenticated by the holder's own link token, the same credential their
 * email carries — there is no session, and the wallet button has to work
 * straight from a mail client.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!isAppleWalletConfigured()) {
    return new Response("Apple Wallet is not configured", { status: 404 });
  }

  const { id } = await ctx.params;
  const accessToken = request.nextUrl.searchParams.get("t");
  if (!accessToken) {
    return new Response("Missing token", { status: 401 });
  }

  // The token has to unlock this exact pass, not merely some pass.
  const lifetime = await findLifetimeByAccessToken(accessToken);
  if (lifetime?.id !== id) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const buffer = await buildLifetimePass({ lifetime });
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${lifetime.number}.pkpass"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (cause) {
    console.error("[wallet] failed to build lifetime pkpass", cause);
    return new Response("Could not build pass", { status: 500 });
  }
}
