/**
 * What an API key is allowed to do.
 *
 * Stored in better-auth's api-key `permissions` column as
 * `{ notifications: ["topic", "direct"] }`, and written here as
 * `"notifications:topic"` everywhere else. One list drives the server check,
 * the create dialog's checkboxes and the API reference, so a new scope is one
 * entry. A future API gets its own resource next to `notifications`.
 *
 * Client-safe: the admin's create dialog imports it.
 */
export const API_SCOPES = {
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

/** Longest key name. The plugin's own default is 32, so it is set from this. */
export const KEY_NAME_MAX_LENGTH = 64;

/** Requests a key may make per minute, enforced by the api-key plugin. */
export const KEY_REQUESTS_PER_MINUTE = 60;

/** Expiry choices when a key is made, in days. No choice means it never expires. */
export const KEY_EXPIRY_DAYS = [30, 90, 365] as const;
export type KeyExpiryDays = (typeof KEY_EXPIRY_DAYS)[number];

type Scopes = typeof API_SCOPES;
type Resource = keyof Scopes;

/** `"notifications:topic"`, and so on for every entry in `API_SCOPES`. */
export type ApiScope = {
  [R in Resource]: `${R}:${keyof Scopes[R] & string}`;
}[Resource];

/** The plugin's shape: resource to actions. */
export type ApiKeyPermissions = Record<string, string[]>;

export const ALL_SCOPES = Object.entries(API_SCOPES).flatMap(
  ([resource, actions]) =>
    Object.entries(actions).map(([action, meta]) => ({
      scope: `${resource}:${action}` as ApiScope,
      ...meta,
    })),
);

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
