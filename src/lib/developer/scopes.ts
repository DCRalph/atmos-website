/**
 * What an API key is allowed to do.
 *
 * Stored in better-auth's api-key `permissions` column as
 * `{ gigs: ["read", "write"] }`, and written here as `"gigs:read"` everywhere
 * else. One list drives the server check, the create dialog's checkboxes and
 * the API reference, so a new scope is one entry.
 *
 * `sensitive` scopes never grant an endpoint on their own. They widen what the
 * matching read returns: buyer contact details, a private event's access key,
 * the names at the door. A dashboard key can read every number without ever
 * holding a customer's email address.
 *
 * Client-safe: the admin's create dialog imports it.
 */
export const API_SCOPES = {
  gigs: {
    read: {
      label: "Read gigs",
      description:
        "Gigs including drafts and TBA ones, with their real details, line-up and tags.",
      dangerous: false,
    },
    sensitive: {
      label: "Gig run sheets",
      description:
        "Adds the internal run sheet to gigs: cues, notes, and which staff hear them.",
      dangerous: true,
    },
    write: {
      label: "Edit gigs",
      description:
        "Create and edit gigs and their line-up and run sheet, publish and unpublish.",
      dangerous: false,
    },
    delete: {
      label: "Delete gigs",
      description: "Delete a gig for good.",
      dangerous: true,
    },
  },
  events: {
    read: {
      label: "Read ticketed events",
      description:
        "Events, tiers, settings and status. No money and no people.",
      dangerous: false,
    },
    sensitive: {
      label: "Event secrets",
      description:
        "Adds a private event's access key and link, and its door staff, to events.",
      dangerous: true,
    },
    write: {
      label: "Edit ticketed events",
      description:
        "Create and edit events and tier plans, publish, pause sales, mark sold out.",
      dangerous: false,
    },
    cancel: {
      label: "Cancel ticketed events",
      description:
        "Cancel an event, or delete one nothing has been sold for. Cancelling stops sales and updates every wallet pass.",
      dangerous: true,
    },
  },
  sales: {
    read: {
      label: "Read sales",
      description:
        "Sold, held and left per tier, revenue, fees, comps, costs and profit, sales over time.",
      dangerous: false,
    },
  },
  door: {
    read: {
      label: "Read the door",
      description: "Admitted, inside now, turned away, scan rate, door sales.",
      dangerous: false,
    },
    sensitive: {
      label: "Door names",
      description: "Adds the latest scans to the door, with attendee names.",
      dangerous: true,
    },
  },
  orders: {
    read: {
      label: "Read orders",
      description:
        "Orders with their status, tickets and amounts. No buyer details.",
      dangerous: false,
    },
    sensitive: {
      label: "Buyer details",
      description:
        "Adds buyer and attendee names, emails and phone numbers to orders. Personal data.",
      dangerous: true,
    },
    manage: {
      label: "Manage orders",
      description: "Resend tickets and issue comps. Both email people.",
      dangerous: true,
    },
    refund: {
      label: "Refund orders",
      description: "Refund an order through Stripe. Moves money.",
      dangerous: true,
    },
  },
  venues: {
    read: {
      label: "Read venues",
      description: "Every saved venue.",
      dangerous: false,
    },
    write: {
      label: "Edit venues",
      description: "Create and edit venues.",
      dangerous: false,
    },
  },
  artists: {
    read: {
      label: "Search artists",
      description: "Artist profiles by name, for building a line-up by id.",
      dangerous: false,
    },
  },
  updates: {
    read: {
      label: "Read updates",
      description:
        "The update feed. Each update also needs the read scope of what it is about.",
      dangerous: false,
    },
  },
  notifications: {
    recipients: {
      label: "Discover recipients",
      description:
        "List topics, staff and their devices: GET /api/v1/notifications/recipients.",
      dangerous: false,
    },
    topic: {
      label: "Send to topics",
      description:
        "Any topic except announcements, through v1 or the ntfy endpoint.",
      dangerous: false,
    },
    announce: {
      label: "Send announcements",
      description:
        "The announcements topic, which reaches every install, punters included.",
      dangerous: true,
    },
    direct: {
      label: "Send to people and devices",
      description: "Named staff, or one of their handsets.",
      dangerous: false,
    },
  },
} as const satisfies Record<
  string,
  Record<string, { label: string; description: string; dangerous: boolean }>
>;

/** What a resource is called in the create dialog and the reference. */
export const SCOPE_RESOURCE_LABELS = {
  gigs: "Gigs",
  events: "Ticketed events",
  sales: "Sales",
  door: "Door",
  orders: "Orders",
  venues: "Venues",
  artists: "Artists",
  updates: "Updates",
  notifications: "Notifications",
} as const satisfies Record<keyof typeof API_SCOPES, string>;

/** Longest key name. The plugin's own default is 32, so it is set from this. */
export const KEY_NAME_MAX_LENGTH = 64;

/** Requests a key may make per minute, enforced by the api-key plugin. */
export const KEY_REQUESTS_PER_MINUTE = 120;

/** Expiry choices when a key is made, in days. No choice means it never expires. */
export const KEY_EXPIRY_DAYS = [30, 90, 365] as const;
export type KeyExpiryDays = (typeof KEY_EXPIRY_DAYS)[number];

type Scopes = typeof API_SCOPES;
export type ScopeResource = keyof Scopes;
type Resource = ScopeResource;

/** `"notifications:topic"`, and so on for every entry in `API_SCOPES`. */
export type ApiScope = {
  [R in Resource]: `${R}:${keyof Scopes[R] & string}`;
}[Resource];

/** The plugin's shape: resource to actions. */
export type ApiKeyPermissions = Record<string, string[]>;

type ScopeMeta = { label: string; description: string; dangerous: boolean };

/** Every scope with its resource and description, in `API_SCOPES` order. */
export const ALL_SCOPES: (ScopeMeta & {
  scope: ApiScope;
  resource: Resource;
})[] = Object.entries(
  // Widened so `Object.entries` sees one shape rather than a union of them.
  API_SCOPES as Record<string, Record<string, ScopeMeta>>,
).flatMap(([resource, actions]) =>
  Object.entries(actions).map(([action, meta]) => ({
    scope: `${resource}:${action}` as ApiScope,
    resource: resource as Resource,
    ...meta,
  })),
);

/**
 * Starting points in the create dialog. Picking one sets the checkboxes, which
 * can then be changed; a key stores scopes, never which preset made it.
 */
export const SCOPE_PRESETS = [
  {
    label: "Read only",
    scopes: [
      "gigs:read",
      "events:read",
      "sales:read",
      "door:read",
      "orders:read",
      "venues:read",
      "artists:read",
      "updates:read",
    ],
  },
  {
    label: "Content editor",
    scopes: [
      "gigs:read",
      "gigs:write",
      "events:read",
      "events:write",
      "venues:read",
      "venues:write",
      "artists:read",
    ],
  },
  {
    label: "Box office",
    scopes: [
      "events:read",
      "sales:read",
      "door:read",
      "orders:read",
      "orders:sensitive",
      "orders:manage",
      "updates:read",
    ],
  },
  {
    label: "Everything",
    scopes: ALL_SCOPES.map((entry) => entry.scope),
  },
] as const satisfies readonly { label: string; scopes: readonly ApiScope[] }[];

export function isApiScope(value: string): value is ApiScope {
  return ALL_SCOPES.some((entry) => entry.scope === value);
}

/** `["notifications:topic"]` to `{ notifications: ["topic"] }`, for the plugin. */
export function scopesToPermissions(scopes: ApiScope[]): ApiKeyPermissions {
  const permissions: ApiKeyPermissions = {};
  for (const scope of new Set(scopes)) {
    const [resource, action] = splitScope(scope);
    (permissions[resource] ??= []).push(action);
  }
  return permissions;
}

/**
 * The reverse, for display. Unknown entries are dropped rather than shown, so
 * a scope removed from `API_SCOPES` stops appearing (and stops working).
 */
export function permissionsToScopes(
  permissions: ApiKeyPermissions | null,
): ApiScope[] {
  if (!permissions) return [];
  return Object.entries(permissions)
    .flatMap(([resource, actions]) =>
      actions.map((action) => `${resource}:${action}`),
    )
    .filter(isApiScope);
}

export function hasScope(
  permissions: ApiKeyPermissions | null,
  scope: ApiScope,
): boolean {
  const [resource, action] = splitScope(scope);
  return permissions?.[resource]?.includes(action) ?? false;
}

function splitScope(scope: ApiScope): [string, string] {
  const [resource = "", action = ""] = scope.split(":");
  return [resource, action];
}
