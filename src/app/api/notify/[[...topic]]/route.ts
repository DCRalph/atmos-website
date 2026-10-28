import type { NextRequest } from "next/server";

import { parsePublishRequest } from "~/lib/notify/ntfy-request";
import { scopeForTarget } from "~/lib/notify/send-request";
import {
  authenticate,
  authorize,
  type ApiAuthFailure,
} from "~/server/api-keys";
import { publish } from "~/server/notify";

/**
 * ntfy-compatible publish endpoint.
 *
 *   curl -H "Authorization: Bearer $ATMOS_API_KEY" \
 *        -H "Title: Side door" -H "Priority: high" \
 *        -d "Card reader is down" https://atmosmedia.co.nz/api/notify/team
 *
 * The point of matching ntfy rather than inventing a shape is that everything
 * that already speaks ntfy — Uptime Kuma, Home Assistant, a shell script, the
 * ntfy CLI with `--url` pointed here — can notify the team without a shim.
 *
 * Auth is an API key from /admin/developer with `notifications:topic` (and
 * `notifications:announce` for `announcements`), or the legacy shared
 * `NOTIFY_TOKEN`, which can publish anywhere. Either is accepted in all three
 * forms ntfy accepts: a bearer token, HTTP basic where the password is the
 * token, and `?auth=` carrying the base64url of the whole header.
 *
 * Not implemented, and answered with 400 rather than silently dropped: message
 * caching and the `since=` replay, subscription over `/json`, `/sse` and
 * `/ws`, attachments, scheduled delivery, actions, and email forwarding.
 *
 * See `docs/NOTIFICATIONS.md`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ topic?: string[] }> };

export async function POST(
  request: NextRequest,
  context: Context,
): Promise<Response> {
  return handle(request, context);
}

/** ntfy accepts PUT as an alias for POST, for clients that cannot send POST. */
export async function PUT(
  request: NextRequest,
  context: Context,
): Promise<Response> {
  return handle(request, context);
}

/** `GET /api/notify/{topic}?message=…`, for a publish from a plain URL. */
export async function GET(
  request: NextRequest,
  context: Context,
): Promise<Response> {
  return handle(request, context);
}

async function handle(
  request: NextRequest,
  context: Context,
): Promise<Response> {
  const authed = await authenticate(request, { allowLegacyToken: true });
  if (!authed.ok) return ntfyFailure(authed.failure);

  const { topic } = await context.params;
  const body = request.method === "GET" ? "" : await request.text();

  const parsed = parsePublishRequest({
    pathSegments: topic ?? [],
    searchParams: request.nextUrl.searchParams,
    headers: request.headers,
    body,
  });

  if (!parsed.ok) {
    return ntfyError(400, 40001, parsed.error);
  }

  const denied = authorize(
    authed.caller,
    scopeForTarget({ topic: parsed.input.topic }),
  );
  if (denied) return ntfyFailure(denied);

  const message = await publish(parsed.input, {
    source: "api",
    apiKeyId: authed.caller.keyId ?? undefined,
  });
  return Response.json(message);
}

/** ntfy's codes are the HTTP status with two digits on the end. */
function ntfyFailure(failure: ApiAuthFailure): Response {
  const response = ntfyError(
    failure.status,
    failure.status * 100 + 1,
    failure.message,
  );
  if (failure.retryAfter) {
    response.headers.set("Retry-After", String(failure.retryAfter));
  }
  return response;
}

/** ntfy's error shape, so a client that parses its errors keeps working. */
function ntfyError(status: number, code: number, error: string): Response {
  return Response.json({ code, http: status, error }, { status });
}
