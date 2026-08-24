import { timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

import { env } from "~/env";
import { parsePublishRequest } from "~/lib/notify/ntfy-request";
import { publish } from "~/server/notify";

/**
 * ntfy-compatible publish endpoint.
 *
 *   curl -H "Authorization: Bearer $NOTIFY_TOKEN" \
 *        -H "Title: Side door" -H "Priority: high" \
 *        -d "Card reader is down" https://atmosmedia.co.nz/api/notify/team
 *
 * The point of matching ntfy rather than inventing a shape is that everything
 * that already speaks ntfy — Uptime Kuma, Home Assistant, a shell script, the
 * ntfy CLI with `--url` pointed here — can notify the team without a shim.
 *
 * Auth is a single shared secret in `NOTIFY_TOKEN`, accepted in all three
 * forms ntfy accepts it: a bearer token, HTTP basic where the password is the
 * token, and `?auth=` carrying the base64url of the whole header. There are no
 * per-topic permissions: anyone holding the secret can publish anywhere, so
 * treat it as an internal credential.
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
  if (!authorised(request)) {
    return ntfyError(401, 40101, "unauthorized");
  }

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

  const message = await publish(parsed.input, { source: "api" });
  return Response.json(message);
}

/**
 * The shared secret, in any of ntfy's three forms.
 *
 * Fails closed when `NOTIFY_TOKEN` is unset — an unconfigured deployment
 * should refuse to publish, not publish for anyone who asks.
 */
function authorised(request: NextRequest): boolean {
  const expected = env.NOTIFY_TOKEN;
  if (!expected) return false;

  const header =
    request.headers.get("authorization") ??
    decodeQueryAuth(request.nextUrl.searchParams.get("auth"));
  if (!header) return false;

  const presented = bearerToken(header) ?? basicPassword(header);
  return presented !== null && secretsMatch(presented, expected);
}

function bearerToken(header: string): string | null {
  if (!/^Bearer /i.test(header)) return null;
  return header.slice("Bearer ".length).trim();
}

/** ntfy sends the token as the basic-auth password; the username is ignored. */
function basicPassword(header: string): string | null {
  if (!/^Basic /i.test(header)) return null;

  const decoded = decodeBase64(header.slice("Basic ".length).trim());
  if (decoded === null) return null;

  const separator = decoded.indexOf(":");
  return separator === -1 ? null : decoded.slice(separator + 1);
}

/** `?auth=` carries the base64url of the entire `Authorization` header value. */
function decodeQueryAuth(param: string | null): string | null {
  if (!param) return null;
  return decodeBase64(param.replaceAll("-", "+").replaceAll("_", "/"));
}

function decodeBase64(value: string): string | null {
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    return decoded.length > 0 ? decoded : null;
  } catch {
    return null;
  }
}

/**
 * Constant-time comparison. The length check leaks the secret's length, which
 * is the same thing `timingSafeEqual` throwing on a length mismatch would.
 */
function secretsMatch(presented: string, expected: string): boolean {
  const a = Buffer.from(presented, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** ntfy's error shape, so a client that parses its errors keeps working. */
function ntfyError(status: number, code: number, error: string): Response {
  return Response.json({ code, http: status, error }, { status });
}
