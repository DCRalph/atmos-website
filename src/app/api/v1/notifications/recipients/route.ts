import { apiError, authenticate, authorize } from "~/server/api-keys";
import { listRecipients } from "~/server/recipients";

/**
 * `GET /api/v1/notifications/recipients`: every topic with a device count,
 * staff with their handsets, and everyone else as a number.
 *
 * Needs `notifications:recipients`. See `docs/DEVELOPER-API.md`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const authed = await authenticate(request);
  if (!authed.ok) return apiError(authed.failure);

  const denied = authorize(authed.caller, "notifications:recipients");
  if (denied) return apiError(denied);

  return Response.json(await listRecipients());
}
