import "server-only";

import type { WebhookEventPayload } from "resend";

import { SuppressionReason, UnsubscribeVia } from "~Prisma/client";
import { db } from "~/server/db";
import { suppress, unsubscribe } from "./subscribers";

/**
 * What Resend tells us about a mailout email after it went. Matched on the
 * `recipient_id` tag every mailout email carries, so events about ticket and
 * account email fall through untouched.
 *
 * A permanent bounce, a spam complaint, or Resend refusing an address it has
 * suppressed all stop marketing to that person for good. A complaint also
 * takes them off every list, which is what they asked for.
 */
export async function handleMailoutEvent(event: WebhookEventPayload) {
  if (!event.type.startsWith("email.") || !("data" in event)) return false;
  const data = event.data as { tags?: Record<string, string> };
  const recipientId = data.tags?.recipient_id;
  if (!recipientId) return false;

  const recipient = await db.mailoutRecipient.findUnique({
    where: { id: recipientId },
    select: { id: true, subscriberId: true, mailoutId: true },
  });
  if (!recipient) return false;

  const at = new Date(event.created_at);
  const where = { id: recipient.id };

  switch (event.type) {
    case "email.delivered":
      await db.mailoutRecipient.updateMany({
        where: { ...where, deliveredAt: null },
        data: { deliveredAt: at },
      });
      break;
    case "email.opened":
      await db.mailoutRecipient.updateMany({
        where: { ...where, openedAt: null },
        data: { openedAt: at },
      });
      break;
    case "email.clicked":
      await db.mailoutRecipient.updateMany({
        where: { ...where, clickedAt: null },
        data: { clickedAt: at },
      });
      break;
    case "email.bounced": {
      await db.mailoutRecipient.updateMany({
        where: { ...where, bouncedAt: null },
        data: { bouncedAt: at, error: event.data.bounce.message },
      });
      // A full mailbox or a greylist comes back as transient: try again next
      // mailout. Only an address that does not exist stops the mail.
      if (event.data.bounce.type.toLowerCase() === "permanent") {
        await suppress(db, recipient.subscriberId, SuppressionReason.BOUNCED);
      }
      break;
    }
    case "email.complained":
      await db.$transaction(async (tx) => {
        await tx.mailoutRecipient.updateMany({
          where: { ...where, complainedAt: null },
          data: { complainedAt: at },
        });
        await suppress(
          tx,
          recipient.subscriberId,
          SuppressionReason.COMPLAINED,
        );
        await unsubscribe(tx, {
          subscriberId: recipient.subscriberId,
          listIds: "all",
          via: UnsubscribeVia.COMPLAINT,
          mailoutId: recipient.mailoutId,
        });
      });
      break;
    case "email.suppressed":
      await db.mailoutRecipient.update({
        where,
        data: { status: "FAILED", error: "Suppressed by Resend" },
      });
      await suppress(db, recipient.subscriberId, SuppressionReason.RESEND);
      break;
    case "email.failed":
      await db.mailoutRecipient.update({
        where,
        data: { status: "FAILED", error: event.data.failed.reason },
      });
      break;
    default:
      return false;
  }
  return true;
}
