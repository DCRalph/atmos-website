import { z } from "zod";

import { scopeForTarget, sendRequest } from "~/lib/notify/send-request";
import { DIRECT_TOPIC } from "~/lib/notify/topics";
import { apiError, authenticate, authorize } from "~/server/api-keys";
import { publish } from "~/server/notify";
import type { Audience } from "~/server/push";
import { resolveDirectTarget } from "~/server/recipients";

/**
 * `POST /api/v1/notifications/send`: one notification to a topic, to named
 * staff, or to particular handsets.
 *
 * The scope depends on the target: `notifications:topic`, `:announce` for
 * `announcements`, or `:direct`. So the key is checked first, then the body,
 * then the scope. Everything lands in `publish()`, the same path as the ntfy
 * endpoint and the compose screens. See `docs/DEVELOPER-API.md`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const authed = await authenticate(request);
  if (!authed.ok) return apiError(authed.failure);
  const { caller } = authed;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidBody("The body must be JSON.");
  }

  const parsed = sendRequest.safeParse(body);
  if (!parsed.success) return invalidBody(z.prettifyError(parsed.error));
  const { to, ...message } = parsed.data;

  const denied = authorize(caller, scopeForTarget(to));
  if (denied) return apiError(denied);

  let topic = DIRECT_TOPIC;
  let audience: Audience | undefined;
  if ("topic" in to) {
    topic = to.topic;
  } else {
    const resolved = await resolveDirectTarget(to);
    if (!resolved.ok) {
      return apiError(
        {
          status: 400,
          code: "unknown_recipients",
          message:
            "These ids are not staff or staff devices. GET /api/v1/notifications/recipients lists the ones you can use.",
        },
        { ids: resolved.unknown },
      );
    }
    audience = resolved.audience;
  }

  const sent = await publish(
    { topic, ...message },
    {
      source: "api",
      apiKeyId: caller.keyId ?? undefined,
      audience,
      recipients: "topic" in to ? undefined : to,
    },
  );

  return Response.json({
    id: sent.id,
    createdAt: new Date(sent.time * 1000).toISOString(),
    to,
    delivery: sent.delivery,
  });
}

function invalidBody(message: string): Response {
  return apiError({ status: 400, code: "invalid_body", message });
}
