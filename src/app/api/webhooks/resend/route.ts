import { Resend } from "resend";

import { env } from "~/env";
import { handleMailoutEvent } from "~/server/mailouts/events";

export const runtime = "nodejs";

/**
 * Delivery events from Resend: delivered, bounced, complained, suppressed,
 * failed, opened, clicked. Only mailout email acts on them (see
 * `handleMailoutEvent`); everything else is acknowledged and dropped.
 *
 * A separate endpoint from inbound email, because Resend signs each webhook
 * with its own secret. Unset, it refuses everything.
 */
export async function POST(request: Request) {
  if (!env.RESEND_WEBHOOK_SECRET) {
    return new Response("Events are not configured", { status: 503 });
  }
  const payload = await request.text();
  let event;
  try {
    event = new Resend(env.RESEND_API_KEY ?? "unused").webhooks.verify({
      payload,
      headers: {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
      webhookSecret: env.RESEND_WEBHOOK_SECRET,
    });
  } catch {
    return new Response("Invalid signature", { status: 401 });
  }

  await handleMailoutEvent(event);
  return new Response(null, { status: 204 });
}
