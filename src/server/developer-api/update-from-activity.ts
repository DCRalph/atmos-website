import type { ActivityType } from "~Prisma/client";

import type { ApiUpdateType } from "~/lib/developer/updates";

/**
 * Which activity log rows become feed updates, and as what.
 *
 * Pure, so it is tested without a database. Rows are matched on their type and
 * on the ids in their details: an activity that names no gig, event or order
 * is not about anything the feed can point at.
 */

export type UpdateRow = {
  type: ApiUpdateType;
  gigId?: string;
  eventId?: string;
  orderId?: string;
  data?: Record<string, unknown>;
};

const GIG_UPDATES: Partial<Record<ActivityType, ApiUpdateType>> = {
  GIG_CREATED: "gig.created",
  GIG_UPDATED: "gig.updated",
  GIG_PUBLISHED: "gig.published",
  GIG_UNPUBLISHED: "gig.unpublished",
  GIG_DELETED: "gig.deleted",
};

/** The types `setStatus` logs with, which all carry the new `status`. */
const EVENT_STATUS_TYPES: ReadonlySet<ActivityType> = new Set<ActivityType>([
  "TICKET_EVENT_PUBLISHED",
  "TICKET_EVENT_CANCELLED",
  "TICKET_EVENT_UPDATED",
]);

export function updateFromActivity(
  type: ActivityType,
  details: Record<string, unknown> | undefined,
): UpdateRow | null {
  const gigId = idIn(details, "gigId");
  const eventId = idIn(details, "eventId");
  const orderId = idIn(details, "orderId");

  const gigUpdate = GIG_UPDATES[type];
  if (gigUpdate) return gigId ? { type: gigUpdate, gigId } : null;

  if (type === "TICKET_EVENT_CREATED" && eventId) {
    return { type: "event.created", eventId };
  }
  if (type === "TICKET_EVENT_DELETED" && eventId) {
    return { type: "event.deleted", eventId };
  }
  const status = details?.status;
  if (EVENT_STATUS_TYPES.has(type) && eventId && typeof status === "string") {
    return { type: "event.status_changed", eventId, data: { status } };
  }
  if (type === "TICKET_ORDER_REFUNDED" && orderId) {
    const amountCents = details?.amountCents;
    return {
      type: "order.refunded",
      orderId,
      data: typeof amountCents === "number" ? { amountCents } : {},
    };
  }
  return null;
}

function idIn(
  details: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = details?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
