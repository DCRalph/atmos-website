import type { NextRequest } from "next/server";

import { env } from "~/env";
import { drainMailouts } from "~/server/mailouts/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Every minute (see `vercel.json`): start any scheduled mailout that is due,
 * and keep sending whatever is queued. A send started from the admin begins
 * straight away without waiting for this; this is what finishes a big one and
 * picks up after a crash.
 */
export async function GET(request: NextRequest): Promise<Response> {
  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
  const authorized =
    !env.CRON_SECRET ||
    request.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
  if (!authorized) return new Response("Unauthorized", { status: 401 });

  return Response.json(await drainMailouts());
}
