import type { NextRequest } from "next/server";

import { env } from "~/env";
import { sweepRunSheets } from "~/server/run-sheet";

/**
 * The run sheet ticker.
 *
 * Called every minute by an external scheduler — cron-job.org, a GitHub Action,
 * the Uptime Kuma that already watches the site. Not a Vercel cron, because
 * minute-frequency crons are a paid tier and this needs to be minute-accurate
 * to be worth having at all.
 *
 *   * * * * *  curl -H "Authorization: Bearer $CRON_SECRET" \
 *                   https://atmosmedia.co.nz/api/cron/run-sheet
 *
 * The `?key=` form is there for schedulers that can only fetch a URL. Both are
 * the same secret as the ticketing sweep; anything that can call one can call
 * the other, and neither does anything a stranger would find interesting.
 *
 * Missing a minute is survivable and duplicating one is not, so all the care
 * lives in `sweepRunSheets`: it reserves each cue before sending it and writes
 * off anything too far overdue.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  return run(request);
}

/** Some schedulers only POST. */
export async function POST(request: NextRequest): Promise<Response> {
  return run(request);
}

async function run(request: NextRequest): Promise<Response> {
  if (!authorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await sweepRunSheets();
  return Response.json(result);
}

function authorized(request: NextRequest): boolean {
  if (!env.CRON_SECRET) return true;
  if (request.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`) {
    return true;
  }
  return request.nextUrl.searchParams.get("key") === env.CRON_SECRET;
}
