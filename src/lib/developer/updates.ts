import type { ApiScope } from "./scopes";

/**
 * Every kind of update the feed carries, the scope a key needs to see it, and
 * what it means. One list drives the feed's filter, the reference and the
 * playground's type picker.
 *
 * Updates are thin: they say what changed and carry a few non-personal facts
 * in `data`. The detail is one request away, through the endpoint for the
 * thing named, under that endpoint's own scopes.
 *
 * Client-safe.
 */
export const API_UPDATE_TYPES = {
  "gig.created": { scope: "gigs:read", description: "A gig was created." },
  "gig.updated": {
    scope: "gigs:read",
    description: "A gig's details, line-up or run sheet changed.",
  },
  "gig.published": {
    scope: "gigs:read",
    description: "A draft gig went live.",
  },
  "gig.unpublished": {
    scope: "gigs:read",
    description: "A live gig went back to draft.",
  },
  "gig.deleted": { scope: "gigs:read", description: "A gig was deleted." },
  "event.created": {
    scope: "events:read",
    description: "A ticketed event was created.",
  },
  "event.updated": {
    scope: "events:read",
    description: "An event's settings or tier plan changed.",
  },
  "event.status_changed": {
    scope: "events:read",
    description:
      "Published, sales paused, sold out, cancelled or archived. `data.status` says which.",
  },
  "event.deleted": {
    scope: "events:read",
    description: "An event was deleted.",
  },
  "order.paid": {
    scope: "sales:read",
    description:
      "An order was paid, or a free one issued. `data` has its tickets and total.",
  },
  "order.refunded": {
    scope: "sales:read",
    description: "Some or all of an order was refunded.",
  },
  "tier.sold_out": {
    scope: "sales:read",
    description: "A tier sold its last ticket. `data` names the tier.",
  },
  "sales.milestone": {
    scope: "sales:read",
    description:
      "An event passed 25, 50, 75, 90 or 100 percent of its capacity. `data.percent` says which.",
  },
} as const satisfies Record<string, { scope: ApiScope; description: string }>;

export type ApiUpdateType = keyof typeof API_UPDATE_TYPES;

export const API_UPDATE_TYPE_NAMES = Object.keys(
  API_UPDATE_TYPES,
) as ApiUpdateType[];

/** The share of capacity sold at which `sales.milestone` fires. */
export const SALES_MILESTONES = [25, 50, 75, 90, 100] as const;

/** Milestones passed by going from `before` to `after` tickets of `capacity`. */
export function milestonesCrossed(
  before: number,
  after: number,
  capacity: number,
): number[] {
  if (capacity <= 0 || after <= before) return [];
  return SALES_MILESTONES.filter((percent) => {
    const at = (capacity * percent) / 100;
    return before < at && after >= at;
  });
}

/** How long updates stay in the feed. */
export const UPDATE_RETENTION_DAYS = 30;
