# Developer API

A JSON API for other systems: gigs, ticketed events, sales, the door, orders,
venues, artists, an update feed, and push notifications. Keys, the reference
and a playground live at **Admin → Developer**, superadmins only.

The reference in the admin is the one to read for using the API. This file is
how it works and why.

## The shape of it

```
/api/v1/[...path]  →  router.ts  →  registry.ts  →  endpoints/*.ts
                                                     ├─ reads: Prisma, with explicit selects
                                                     └─ writes: the admin's tRPC procedures
```

Everything lives in `src/server/developer-api/`.

- **One list of endpoints.** Each is a `defineEndpoint({ method, path, scope,
params, query, body, response, run })` in `endpoints/`. Every input and
  output is a Zod schema, and the router uses them for everything: it
  validates the request against them, strips the response down to what the
  response schema describes (so an internal field can never leak by
  accident), and `openapi.ts` turns them into the OpenAPI 3.1 spec. Adding an
  endpoint is one `defineEndpoint` in the list; the reference and playground
  follow.
- **One route.** `src/app/api/v1/[...path]/route.ts` hands every request to
  `handleApiRequest`. `GET /api/v1/openapi.json` serves the spec, unauthenticated.
- **Writes go through the admin's own procedures**, using the bridge Will GPT
  uses (`createCaller`). Validation, inventory locks, slug claiming, tier
  plans, wallet pass pushes and activity logging are exactly what an edit in
  the admin gets. No business rule exists twice.
- **Reads go straight to the database** with their own `select`, so what an
  integration sees is a stable contract rather than whatever an admin screen
  happens to need. The two stats endpoints are the exception: they call the
  event dashboard's analytics procedures, so the numbers always agree.

### Who a key acts as

Admin procedures need a signed-in user. The migration creates one, the
**Developer API** system user (`id: developer-api`), with no account and no
permission rows: it cannot sign in, and it appears in no staff list.

During an API call, `adminCallerFor` (`caller.ts`) builds a tRPC context
signed in as that user, with `apiCaller` set. `loadUser` in
`src/server/api/trpc.ts` hands the system user `ADMIN` only while
`apiCaller` is set. Never `SUPERADMIN`, and no endpoint maps to a superadmin
procedure. What a key can reach is the endpoint list, each behind its scope.

Every activity log row written during an API request also records the key,
in `ActivityLog.apiKeyId`, through an `AsyncLocalStorage` set by the router
(`request-context.ts`). The activity log names the Developer API as the
user, and the row says which key it was.

## API keys

### The plugin

`@better-auth/api-key`. It hashes keys, rate limits them, and gives us
`auth.api.createApiKey` and `verifyApiKey` on the server.

```ts
apiKey({
  defaultPrefix: "atmos_",
  startingCharactersConfig: { shouldStore: true, charactersLength: 10 },
  requireName: true,
  enableMetadata: false,
  rateLimit: { enabled: true, timeWindow: 60_000, maxRequests: 120 },
  keyExpiration: { defaultExpiresIn: null, minExpiresIn: 0 },
});
```

**Its HTTP routes are switched off** (`disabledPaths`), because as shipped any
signed-in account, a punter included, could mint itself a key. Every key
operation goes through the `developer` tRPC router, which is
`superadminProcedure` throughout. `minExpiresIn: 0` is for the playground's
one-hour keys; the admin's own choices are 30, 90 or 365 days, or never.

Keys belong to the site rather than to whoever made them: every superadmin
sees and manages every key, and a key keeps working if its creator loses
superadmin. The full key is shown once, in the create dialog.

### Scopes

`src/lib/developer/scopes.ts` is the vocabulary, as a `const` object, so the
server check, the create dialog and the reference come from one list. Stored
in the plugin's `permissions` as `{ gigs: ["read", "write"] }`, written
`gigs:read` everywhere else.

| Resource        | Scopes                                      |
| --------------- | ------------------------------------------- |
| `gigs`          | `read`, `sensitive`, `write`, `delete`      |
| `events`        | `read`, `sensitive`, `write`, `cancel`      |
| `sales`         | `read`                                      |
| `door`          | `read`, `sensitive`                         |
| `orders`        | `read`, `sensitive`, `manage`, `refund`     |
| `venues`        | `read`, `write`                             |
| `artists`       | `read`                                      |
| `updates`       | `read`                                      |
| `notifications` | `recipients`, `topic`, `announce`, `direct` |

Rules:

- **Read and write are always separate**, so a dashboard key can never edit.
- **`sensitive` scopes grant no endpoint.** They widen what the matching read
  returns: the internal run sheet on a gig (`gigs:sensitive`), a private
  event's access key and its door staff (`events:sensitive`), recent scans
  with attendee names (`door:sensitive`), buyer and attendee names, emails and
  phones (`orders:sensitive`). Without one, those fields are absent from the
  response, not null. Each resource that holds personal or secret data has
  its own, so a key can read every number without ever holding a customer's
  email address.
- **Anything that reaches people or moves money is its own scope**:
  `gigs:delete`, `events:cancel`, `orders:manage` (resends and comps email
  people), `orders:refund`, `notifications:announce`. These are flagged
  amber in the admin.
- **Some scopes depend on the request.** Writing a run sheet beyond the
  line-up needs `gigs:sensitive` as well as `gigs:write`; cancelling needs
  `events:cancel`; resending tickets to a different address needs
  `orders:sensitive`. An endpoint lists every scope it might need, and the
  router checks the ones this request needs once the body is parsed.
  A key with none of them is refused before its body is read.

The create dialog offers presets (Read only, Content editor, Box office,
Everything) that set the checkboxes; a key stores scopes, not the preset.

Not offered: users, permissions, invites, sign-in, keys, mailouts, contracts,
rentals, patrons and ID checks.

## Endpoints

| Method          | Path                                        | Scope                                         |
| --------------- | ------------------------------------------- | --------------------------------------------- |
| `GET`           | `/me`                                       | any key                                       |
| `GET`           | `/updates`                                  | `updates:read`                                |
| `GET`           | `/gigs`, `/gigs/{id}`, `/gig-tags`          | `gigs:read`                                   |
| `POST`          | `/gigs`                                     | `gigs:write` (+ `sensitive` for cues)         |
| `PATCH`         | `/gigs/{id}`                                | `gigs:write` (+ `sensitive` for runSheet)     |
| `POST`          | `/gigs/{id}/publish`, `/unpublish`          | `gigs:write`                                  |
| `DELETE`        | `/gigs/{id}`                                | `gigs:delete`                                 |
| `GET`           | `/events`, `/events/{id}`                   | `events:read`                                 |
| `POST`          | `/events`                                   | `events:write`                                |
| `PATCH`         | `/events/{id}`                              | `events:write`                                |
| `POST`          | `/events/{id}/status`                       | `events:write` (+ `cancel`)                   |
| `DELETE`        | `/events/{id}`                              | `events:cancel`                               |
| `GET`           | `/events/{id}/stats`, `/stats/timeline`     | `sales:read`                                  |
| `GET`           | `/events/{id}/door`                         | `door:read`                                   |
| `GET`           | `/events/{id}/orders`, `/orders/{id}`       | `orders:read`                                 |
| `POST`          | `/orders/{id}/resend`, `/events/{id}/comps` | `orders:manage`                               |
| `POST`          | `/orders/{id}/refund`                       | `orders:refund`                               |
| `GET`           | `/venues`                                   | `venues:read`                                 |
| `POST`, `PATCH` | `/venues`, `/venues/{id}`                   | `venues:write`                                |
| `GET`           | `/artists`                                  | `artists:read`                                |
| `GET`           | `/notifications/recipients`                 | `notifications:recipients`                    |
| `POST`          | `/notifications/send`                       | `notifications:topic`, `announce` or `direct` |

New gigs are drafts unless the body says otherwise; new events always are,
and are published with the status endpoint.

### Conventions

- JSON in and out. Times ISO 8601 with an offset going in, UTC coming out.
  Money in integer cents, NZD.
- `PATCH` takes only what changes (`null` clears). Run sheets and tier plans
  are whole lists naming saved rows by id, as in the admin's own `update`
  procedures.
- Lists take `limit` (≤ 100) and `cursor`, and return
  `{ data, nextCursor }`, `nextCursor` null on the last page.
- Errors are `{ "error": { "code", "message" } }`, extras inside `error`
  (`issues`, `missing`, `ids`). tRPC errors from the admin procedures map to
  400, 403, 404, 409 or 429; one that wraps an unexpected failure becomes a
  plain 500 with the request id, so a database message never leaves.
- Every response has `X-Request-Id`, and `X-RateLimit-Remaining` for a
  limited key.

The notification endpoints moved into the list unchanged on the wire,
including `400 invalid_body` and `400 unknown_recipients`. `/api/notify`, the
ntfy endpoint, is untouched and still takes `NOTIFY_TOKEN` as well as keys.

## The update feed

`ApiUpdate` is one row per thing an integration might want to hear about.
`GET /updates?cursor=…&types=…` returns them oldest first with a
`nextCursor`, which comes back unchanged when nothing is new, so polling is
the whole protocol. `cursor=now` starts from the latest. Rows younger than
two seconds are held back, because an autoincrement id is handed out at
insert, not at commit. Kept 30 days, pruned by the ticketing sweep.

Updates are **thin**: a type, the ids it is about, and a few facts that are
not personal (a status, a count, a total). The detail is one request away
under that endpoint's own scopes, so the feed never holds personal data and
never goes stale. Each type needs a read scope on top of `updates:read`
(`src/lib/developer/updates.ts`).

Where they come from:

- **The activity log.** `logActivity` hands every row to
  `recordActivityUpdate`, and `update-from-activity.ts` maps the ones it
  knows (gig created, updated, published, unpublished, deleted; event
  created, deleted, status changed; order refunded). Anything the admin,
  Will GPT or the API does lands in the feed without each of them
  remembering to. `gigs.delete` now logs, so deletes are seen.
- **`event.updated`** is recorded by `ticketEvents.update` itself, because
  `TICKET_EVENT_UPDATED` is also logged by unrelated things such as expiring
  holds.
- **Sales** (`order.paid`, `tier.sold_out`, `sales.milestone` at 25, 50, 75,
  90 and 100 percent of capacity) come from `scheduleSalesAlerts`, the one
  place that runs once per paid order and knows which tiers it emptied.

Webhooks were left out on purpose: the feed covers scripts and dashboards,
and pushing to URLs (signing, retries, a delivery log) can be built on these
same rows when something needs it.

## Admin: Developer

Three tabs, superadmin only.

- **Keys**: the list, create, enable, delete. The create dialog groups scopes
  by resource, with presets, and shows a `curl` to `/me` with the new key.
- **Reference**: three panes. Guides (authentication, scopes, conventions,
  errors, the feed, ntfy) are written in `api-reference.tsx`; every endpoint
  page is drawn from the spec, with its fields, scopes, and code in curl,
  JavaScript and Python. "Try it" opens the playground on that endpoint.
- **Playground**: real requests with a real key. A temporary key with picked
  scopes lasts an hour (`developer.createPlaygroundKey`; expired ones are
  deleted when the next is made, and they are hidden from the Keys list), or
  an existing key can be pasted. The key lives in memory only. Anything but a
  GET asks first. Gig and event ids are picked by name. The Updates mode
  polls the feed from now, every five seconds, as an integration would.

## Files

| Where                                         | What                                                   |
| --------------------------------------------- | ------------------------------------------------------ |
| `src/lib/developer/scopes.ts`                 | Scope vocabulary and presets                           |
| `src/lib/developer/updates.ts`                | Update types and milestones                            |
| `src/lib/developer/openapi.ts`, `snippets.ts` | Spec types; examples and code samples for the admin    |
| `src/server/developer-api/`                   | Endpoints, router, registry, spec, caller, feed        |
| `src/app/api/v1/[...path]/`, `openapi.json/`  | The routes                                             |
| `src/server/api/trpc.ts`                      | `apiCaller` on the context; `loadUser`                 |
| `src/server/api-keys.ts`                      | `authenticate`, now with the remaining rate limit      |
| `src/server/utils/activity-log.ts`            | `apiKeyId`, and handing rows to the feed               |
| `src/server/ticketing/sales-alerts.ts`        | Sales updates beside the alerts                        |
| `src/server/api/routers/developer.ts`         | Keys, spec, playground keys and ids                    |
| `src/components/admin/developer/`             | Keys, reference, playground                            |
| `src/prisma/migrations/…_developer_api_v2`    | `api_update`, `activity_log.apiKeyId`, the system user |

## Tests

`bun test src/server/developer-api src/lib/developer` covers the endpoint list
(no clashes, real scopes, path matching, the spec builds), the scopes that
depend on a request, presets, which activity becomes which update, and
milestones.

The rest was proved end to end against the local Postgres: every endpoint
with read-only and full keys, sensitive fields present and absent, missing
scopes, bad bodies, 404 and 405, gig and event create, patch, publish, status
and delete, run sheet and tier plan patches, comps, unknown recipients, the
feed filling from those writes with the key on each activity row, and the
admin pages with a temporary key and the live feed.
