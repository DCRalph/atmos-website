# Developer API

API keys, and a JSON API for sending notifications to topics, staff, or
particular handsets. Managed from **Admin → Developer**, superadmins only.

## Why

The only way for another system to notify the team is `/api/notify`, the
ntfy-compatible endpoint, behind one shared secret (`NOTIFY_TOKEN`). That
leaves three gaps:

1. **Topics only.** An integration can shout at `team`, but cannot ping one
   person or one handset. Run sheet cues can, because they call `publish()`
   from inside the app; nothing outside can.
2. **No discovery.** An integration has no way to ask who it could reach, so
   any per-person send would mean hardcoding ids.
3. **One secret for everything.** Every integration shares `NOTIFY_TOKEN`, it
   can publish to `announcements` (every punter's phone), a leak means rotating
   it everywhere at once, and the history cannot say which integration sent
   what.

## What it is

- **API keys**, from better-auth's `@better-auth/api-key` plugin. Each key is
  named, scoped, revocable on its own, hashed at rest, and rate limited.
- **A notifications API** under `/api/v1/notifications/`: one endpoint to
  discover recipients, one to send to a topic, users, or devices.
- **The ntfy endpoint takes API keys** as well as `NOTIFY_TOKEN`, so
  Uptime Kuma and friends can move to their own keys with no other change.
- **A Developer page in the admin**, `/admin/developer`, for superadmins only:
  manage keys, and read the API reference.

The decisions behind it: `NOTIFY_TOKEN` keeps working on the ntfy endpoint
until every integration has its own key; direct sends reach staff only; and
keys never expire unless one is picked when the key is made.

Not in scope: webhooks, OAuth apps, keys for non-superadmins, an SDK,
delivery receipts beyond what `publish()` already records, or any change to
the mobile app.

## API keys

### The plugin

`@better-auth/api-key@1.6.26` (it matches our `better-auth@1.6.26`; the plugin
moved out of the core package, so it is a new dependency). It adds an `apikey`
table and gives us `auth.api.createApiKey`, `verifyApiKey`, `updateApiKey` and
`deleteApiKey` on the server.

```ts
apiKey({
  defaultPrefix: "atmos_",
  startingCharactersConfig: { shouldStore: true, charactersLength: 10 }, // "atmos_k3Qx"
  enableMetadata: false,
  requireName: true,
  // The plugin's default is 10 requests a DAY. A monitor that alerts more
  // than that is having exactly the night it needs to reach us.
  rateLimit: { enabled: true, timeWindow: 60_000, maxRequests: 60 },
  keyExpiration: { defaultExpiresIn: null },
});
```

**The plugin's HTTP routes are switched off.** As shipped, any signed-in
account (a punter included) can `POST /api/auth/api-key/create` and mint a key
for itself. We set

```ts
disabledPaths: [
  "/api-key/create",
  "/api-key/update",
  "/api-key/delete",
  "/api-key/list",
  "/api-key/get",
];
```

`disabledPaths` is only checked by better-auth's HTTP router (checked in
`better-auth/dist/api/index.mjs`), so the server-side `auth.api.*` calls still
work. Every key operation goes through a `superadminProcedure` tRPC router
instead. No key can be created except by a superadmin in the admin.

### Shape of a key

| Field             | What we use it for                                                 |
| ----------------- | ------------------------------------------------------------------ |
| `name`            | "Uptime Kuma", "Door scanner Pi". Required.                        |
| `start`           | `atmos_k3Qx`, shown in the list so a key in a config can be found. |
| `referenceId`     | The superadmin who created it, shown as "Created by".              |
| `permissions`     | Scopes, below.                                                     |
| `enabled`         | The pause switch. Disabled keys get `401`.                         |
| `expiresAt`       | Optional: 30 days, 90 days or a year. Never, by default.           |
| `lastRequest`     | "Last used". The plugin updates it on every verify.                |
| rate limit fields | Plugin defaults from the config above. Not editable in the UI.     |

Keys belong to the site rather than to the person who created them: every
superadmin sees and manages every key, and a key keeps working if its creator
loses superadmin. `referenceId` has no foreign key, so deleting the creator's
account leaves the key alone and the list shows "Deleted user".

The full key is shown **once**, in the create dialog, and never again. Only its
hash is stored.

An expired key is deleted by the plugin the next time it is used, so it shows
as expired in the list only until then. Its sends stay in the history.

### Scopes

All under one resource, `notifications`, stored in the plugin's `permissions`
as `{ notifications: [...] }`:

| Scope                      | Allows                                                             |
| -------------------------- | ------------------------------------------------------------------ |
| `notifications:recipients` | `GET /api/v1/notifications/recipients`.                            |
| `notifications:topic`      | Send to any topic except `announcements`. v1 or the ntfy endpoint. |
| `notifications:announce`   | Send to `announcements`, which reaches **every install**.          |
| `notifications:direct`     | Send to named users or devices.                                    |

`announce` is its own scope because the existing compose screens already treat
it as the dangerous one (admin-only server-side, absent from the app). A
monitoring key should not be able to reach every punter's phone.

The vocabulary lives in `src/lib/developer/scopes.ts` as a `const` object, so
the server check, the create dialog's checkboxes and the reference page all
come from one list and a new scope is a one-line change. A future API (say,
`/api/v1/tickets/...`) adds its own resource alongside `notifications`.

### Authenticating a request

`src/server/api-keys.ts`:

```ts
authenticate(request, scope): Promise<
  | { ok: true; key: { id: string; name: string } }
  | { ok: false; status: 401 | 403 | 429; error: string }
>
```

- Reads the key from the same three places the ntfy endpoint does: `Bearer`,
  the basic-auth password, or `?auth=`. That parsing moves out of the ntfy
  route into a shared helper.
- Calls `auth.api.verifyApiKey({ body: { key } })` **without** `permissions`,
  then checks the scope itself. The plugin answers a scope mismatch with the
  same "key not found" as a bad key, and an integration author deserves to be
  told "this key can't send to users" rather than "unauthorized".
- Maps the plugin's rate-limit error to `429` with `Retry-After`.

## The notifications API

Base: `https://atmosmedia.co.nz/api/v1/notifications`. JSON in, JSON out.

| Method | Path          | Scope                                                      |
| ------ | ------------- | ---------------------------------------------------------- |
| `GET`  | `/recipients` | `notifications:recipients`                                 |
| `POST` | `/send`       | `notifications:topic`, `:announce` or `:direct`, by target |

Errors are always

```json
{
  "error": {
    "code": "missing_scope",
    "message": "This key cannot send to users."
  }
}
```

| Status | `code`                                             |
| ------ | -------------------------------------------------- |
| 400    | `invalid_body`, `unknown_recipients`               |
| 401    | `unauthorized` (missing, wrong, disabled, expired) |
| 403    | `missing_scope`                                    |
| 429    | `rate_limited`                                     |

### `GET /api/v1/notifications/recipients`

Who and what this API can send to.

```json
{
  "topics": [
    {
      "name": "team",
      "label": "Team",
      "description": "Everyone on the Atmos team…",
      "devices": 6
    },
    {
      "name": "announcements",
      "label": "Announcements",
      "description": "…",
      "devices": 418
    },
    { "name": "kuma", "label": null, "description": null, "devices": 2 }
  ],
  "users": [
    {
      "id": "Yk3…",
      "name": "William Giles",
      "email": "william@…",
      "roles": ["SUPERADMIN", "ADMIN"],
      "devices": [
        {
          "id": "clx…",
          "label": "William's iPhone",
          "platform": "ios",
          "topics": ["announcements", "team", "door", "alerts"],
          "lastSeenAt": "2026-10-28T03:12:00.000Z"
        }
      ]
    }
  ],
  "others": { "devices": 401 }
}
```

- **`topics`**: the known topics plus any other topic at least one device is
  subscribed to, each with a device count.
- **`users`**: staff only (`ADMIN` or `EVENT_ORGANISER`, the same set the
  compose screen's audience panel names), including staff with no devices,
  so "William has no phone registered" is visible rather than a silent zero.
- **`others`**: everyone else, as a count. Punters are never listed. That is
  the rule the compose screen already follows (`docs/NOTIFICATIONS.md`), and an
  API key is a worse place to leak a customer roster than a screen.
- Expo push tokens are never returned. A device is addressed by its row id.

The same function, `listRecipients()` in `src/server/recipients.ts`, backs
this endpoint and the live example on the admin reference page.

### `POST /api/v1/notifications/send`

Send one notification. Exactly one target:

```jsonc
{
  "to": { "topic": "team" }, // notifications:topic (or :announce)
  // or { "users": ["Yk3…", "Pq9…"] }   // notifications:direct
  // or { "devices": ["clx…"] }         // notifications:direct

  "title": "Side door", // optional, ≤ 250 chars
  "message": "Card reader is down", // required, ≤ 4096 chars
  "priority": 4, // 1–5 or "high" etc., default 3
  "click": "/tickets", // optional: absolute URL or app path
  "tags": ["warning", "door"], // optional
}
```

Response `200`:

```json
{
  "id": "clx…",
  "createdAt": "2026-10-28T03:15:00.000Z",
  "to": { "users": ["Yk3…"] },
  "delivery": { "devices": 2, "delivered": 2 }
}
```

Rules:

- The body is a Zod schema with `to` as a union of the three shapes, so the
  handler gets a narrowed type and there is no "topic and users both set"
  case to handle.
- **Users and devices must be discoverable**: every id has to be a staff user,
  or a device belonging to one. Any other id, unknown or a punter's, fails the
  whole request with `400 unknown_recipients` and lists the bad ids. All or
  nothing, because a typo in an id should be loud, not a silent partial send.
  A staff user with no devices is fine and comes back as `devices: 0`, like a
  topic nobody listens to.
- **Direct sends ignore the per-device mute switches**, the same as run sheet
  cues: they are operational. Topic sends behave exactly as today. Without a
  title, a direct send shows "Atmos".
- Up to 50 user or device ids per request.
- Priority, title fallback, sound and the click target go through the existing
  `publish()`, so a v1 send and an ntfy send of the same message arrive
  identically.

### The ntfy endpoint

`/api/notify` is unchanged for its callers. It now accepts:

1. an API key with `notifications:topic` (plus `notifications:announce` for
   `announcements`), in any of the three ntfy auth forms; or
2. `NOTIFY_TOKEN`, as today, treated as a key holding both topic scopes.

Errors keep ntfy's shape there (`{"code":40301,"http":403,"error":"…"}`).

`NOTIFY_TOKEN` is legacy. Once the integrations using it have their own keys,
unset it.

## Recording sends

`publish()` gains two inputs and `NotifyMessage` two columns:

```prisma
model NotifyMessage {
  // …
  /// The key that sent it, for API sends. Null for compose screens, internal
  /// sends, and the legacy NOTIFY_TOKEN.
  apiKeyId String?
  apiKey   ApiKey? @relation(fields: [apiKeyId], references: [id], onDelete: SetNull)
  /// For direct sends, the user or device ids as given. Null for topic sends.
  recipients Json?
}
```

- A direct send is logged with `topic: "direct"`, so it shows up in the
  existing history (#122) next to everything else. The detail view names the
  recipients and the key.
- The history filters gain **API key**, and each row on the Developer page
  links to its own history.
- `Audience` in `src/server/push.ts` gains `{ kind: "devices"; deviceIds }`.
  `users` already exists.

The `ApiKey` model is the plugin's schema, mapped to `apikey`. It ships as an
additive SQL migration in `src/prisma/migrations/`, applied by hand before the
merge, as usual.

## Admin: Developer

One page, `/admin/developer`, two tabs.

**Access.** A `layout.tsx` under `developer/` returns `notFound()` unless the
viewer holds `SUPERADMIN`, and its tRPC router uses `superadminProcedure`. The
nav item is `superadminOnly`, which `useAdminNavigation()` filters on (from
`user.me`) for both the sidebar and the admin search. Hiding it is tidiness,
not protection.

**Keys tab**

- Table: name, `atmos_k3Qx…`, scopes, created by, created, last used, expires,
  an enabled switch, and a delete action behind a confirm.
- Each row links to the notification history filtered to that key.
- **New key**: name, scope checkboxes (`announce` carries a warning line),
  expiry (none, 30 days, 90 days, 1 year). On create, a dialog shows the full
  key once with a copy button and a ready-to-run `curl` using it, and says
  plainly that it cannot be shown again.

**Reference tab**

- Auth, scopes, both notifications endpoints and the ntfy endpoint, with
  request and response examples using the real site URL, plus the error table.
- A live `/recipients` result rendered from `listRecipients()`, so the ids
  needed for a direct send can be copied from here.

The layout follows the existing admin pages (`notifications-manager.tsx`,
`notification-history.tsx`).

### tRPC: `developer` router

| Procedure       | Does                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `keys`          | Every key, with creator name and last use. Reads `apikey` through Prisma, since the plugin's own list is scoped to the caller's keys. |
| `createKey`     | `auth.api.createApiKey({ body: { name, userId, permissions, expiresIn } })`. Returns the plaintext key once.                          |
| `setKeyEnabled` | Flips `enabled` through Prisma. The plugin's update only acts on the caller's own keys.                                               |
| `deleteKey`     | Deletes the row. History rows keep their message and lose the link (`SetNull`).                                                       |
| `recipients`    | `listRecipients()`, for the reference tab.                                                                                            |

Each mutation writes an `ActivityLog` row, as other admin actions do.

## Files

| Where                                                    | Change                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| `package.json`                                           | `@better-auth/api-key@1.6.26`                                |
| `src/server/auth.ts`                                     | `apiKey()` plugin and `disabledPaths`                        |
| `prisma/schema.prisma`, `src/prisma/migrations/…`        | `ApiKey`; `NotifyMessage.apiKeyId`, `.recipients`            |
| `src/lib/developer/scopes.ts`                            | Scope vocabulary                                             |
| `src/lib/notify/request-auth.ts`                         | Bearer / basic / `?auth=` parsing, moved from the ntfy route |
| `src/server/api-keys.ts`                                 | `authenticate(request, scope)`                               |
| `src/server/recipients.ts`                               | `listRecipients()`, `resolveRecipients(to)`                  |
| `src/server/push.ts`, `src/server/notify.ts`             | `devices` audience; `apiKeyId` and `recipients` on publish   |
| `src/app/api/v1/notifications/recipients/route.ts`       | Discovery                                                    |
| `src/app/api/v1/notifications/send/route.ts`             | Send                                                         |
| `src/app/api/notify/[[...topic]]/route.ts`               | Accept API keys                                              |
| `src/server/api/routers/developer.ts`                    | Key management                                               |
| `src/app/(admin)/admin/developer/`                       | Gate and page                                                |
| `src/components/admin/developer/`                        | Keys and reference tabs                                      |
| `src/components/admin/admin-navigation.ts` and consumers | `superadminOnly`                                             |
| `src/components/admin/notification-history.tsx`          | API key filter, recipients in detail                         |
| `docs/NOTIFICATIONS.md`                                  | Auth section rewritten                                       |

## Tests

`bun test src/lib/notify src/lib/developer` covers the send body (each `to`
shape, two targets or none, limits, misspelt fields), which scope a target
needs, the scope round trip through the plugin's shape, and reading a
credential from each of ntfy's three forms.

Who counts as a recipient is a database question, so it was proved end to end
on a local Postgres instead: keys made in the admin, then each endpoint called
with staff, punter and unknown ids, missing scopes, a disabled key, a deleted
key, the legacy token, and past the rate limit.
