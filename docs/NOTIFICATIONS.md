# Team notifications

Push notifications to Atmos handsets, published over an ntfy-compatible HTTP
API.

The reason for copying [ntfy](https://docs.ntfy.sh/publish/) rather than
inventing a shape: everything that already speaks ntfy — Uptime Kuma, Grafana,
Home Assistant, a `curl` in a shell script, the `ntfy` CLI with `--url` pointed
here — can notify the team with no shim on either side.

## The pieces

| Where                                            | What                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `src/lib/notify/topics.ts`                       | The topic vocabulary, and which topics a device is subscribed to by default.          |
| `src/lib/notify/ntfy-request.ts`                 | Turns an ntfy request into a publish. Pure, and where the tests are.                  |
| `src/app/api/notify/[[...topic]]/route.ts`       | The HTTP endpoint: auth and I/O, nothing else.                                        |
| `src/server/notify.ts`                           | `publish()` — the one path a notification takes, whatever published it.               |
| `src/server/push.ts`                             | Expo fan-out, dead-token pruning. Predates this and is shared with gig announcements. |
| `src/server/api/routers/notify.ts`               | tRPC for the compose screens and device management.                                   |
| `src/components/admin/notifications-manager.tsx` | The web admin compose page, at `/admin/notifications`.                                |
| `mobile/app/(admin)/notify.tsx`                  | The app's compose screen, reached from More.                                          |
| `mobile/src/lib/push.ts`                         | Registration and tap routing on the handset.                                          |

Run sheet cues are published through the same `publish()`, with the audience
overridden to the people an admin picked for that gig. See
[RUN-SHEET.md](./RUN-SHEET.md).

## Publishing

```bash
curl -H "Authorization: Bearer $NOTIFY_TOKEN" \
     -H "Title: Side door" \
     -H "Priority: high" \
     -H "Tags: warning,door" \
     -d "Card reader is down, using the backup" \
     https://atmosmedia.co.nz/api/notify/team
```

The same message as JSON, which is what you want when the topic is dynamic:

```bash
curl -H "Authorization: Bearer $NOTIFY_TOKEN" \
     -d '{"topic":"team","title":"Side door","message":"Card reader is down","priority":4}' \
     https://atmosmedia.co.nz/api/notify
```

And from a system that can only fetch a URL:

```
https://atmosmedia.co.nz/api/notify/team?message=Card+reader+is+down&title=Side+door&auth=<base64url>
```

Fields are read from headers first, then the query string, then the body — so
all three forms above are the same publish. Every ntfy alias is accepted:
`Title`/`X-Title`/`t`, `Priority`/`X-Priority`/`prio`/`p`,
`Tags`/`X-Tags`/`tag`/`ta`, `Message`/`X-Message`/`m`, `Click`/`X-Click`.
Priority takes `1`–`5` or `min`/`low`/`default`/`high`/`max`/`urgent`.
`PUT` works as an alias for `POST`, and `/{topic}/publish`, `/send` and
`/trigger` all work.

The response is ntfy's message object, plus a `delivery` field that is ours:

```json
{
  "id": "clx…",
  "time": 1774310400,
  "event": "message",
  "topic": "team",
  "title": "Side door",
  "message": "Card reader is down",
  "priority": 4,
  "tags": ["warning", "door"],
  "delivery": { "devices": 6, "delivered": 6 }
}
```

Errors use ntfy's shape too — `{"code":40101,"http":401,"error":"unauthorized"}`.

### What is deliberately not implemented

Each of these is a feature rather than a parsing detail, and a request using one
gets a `400` rather than having it silently dropped:

- Subscribing over `/json`, `/sse`, `/raw` and `/ws`, and the message cache and
  `since=` replay behind them. A push either reaches a handset or it does not;
  there is nothing to replay from.
- Multi-topic publish (`/topic1,topic2`), attachments, scheduled delivery
  (`Delay`, `At`, `In`), action buttons, icons, and email forwarding.

## Topics

A topic is any string of 1–64 letters, digits, dashes or underscores, exactly as
in ntfy. Publishing to one nobody is subscribed to **succeeds** with
`devices: 0` — that is what a message board does, and it means an integration
can invent its own topic without a code change.

The four that mean something here:

| Topic           | Who hears it                                                             |
| --------------- | ------------------------------------------------------------------------ |
| `team`          | Admins and event organisers. The default for a message to us.            |
| `door`          | The same people. Problems at a door that need a hand now.                |
| `alerts`        | Admins only, so a failed webhook does not wake a scanner.                |
| `announcements` | **Every install, punters included.** Treat anything sent here as public. |

Subscriptions are per device, not per person, so muting a topic on a work phone
leaves it alone on your own. A device is seeded from its owner's permissions
when it first registers and again when it changes hands — but never on an
ordinary launch, or a topic taken off a device in the admin would come straight
back the next time the app opened.

## Auth

One shared secret, `NOTIFY_TOKEN`, accepted as a bearer token, as the password
in HTTP basic (the username is ignored), or as `?auth=` carrying the base64url
of the whole `Authorization` header. There are no per-topic permissions: anyone
holding it can publish anywhere, including `announcements`, so it is an internal
credential and belongs nowhere near a client.

**Unset means the endpoint refuses everything.** A notification channel anyone
can post to is a notification channel nobody reads.

The compose screens do not use it. They go through tRPC as the signed-in user:
organisers can publish, and `announcements` is admin-only.

## The compose screens

Both are laid out audience-first, because the risky part of sending is not
writing the message, it is picking the topic: `announcements` reaches every
install and `team` reaches six of us, and in a dropdown those look identical.

**`/admin/notifications`** puts the topic list, with a live device count on each
row, beside a panel naming the handsets that are about to light up. That panel
is also where a handset is subscribed or unsubscribed, so there is no separate
device-management page. Only staff handsets are ever named; everything else
subscribed is a count, which is both the honest way to show four hundred punters
and what stops an organiser reading a customer roster off the screen.

**The app's screen**, under More for organisers, is the same idea at door
length: topic, who hears it by name, title, message, normal or high, send. It
offers `team`, `door` and `alerts` only. `announcements` is absent by design, on
top of being refused server-side for a non-admin: a phone in a dark venue is not
where the decision to push to every punter should be made.

## Delivery

Expo brokers APNs, so nothing here handles a certificate. ntfy priority maps
onto what Expo actually offers — 1 and 2 arrive silently at normal priority, 3
is the default, 4 and 5 arrive at high priority with a sound. ntfy's emoji tag
shorthand is not implemented; tags travel in the notification payload as text.

`ntfy`'s `Click` becomes the tap target. An absolute URL opens in the browser; a
path like `/tickets` opens that screen in the app.

### Apple, one time

Production builds need an APNs key on file with Expo or a push to a TestFlight
or App Store build silently goes nowhere, even though it works on a development
build. From App Store Connect, under **Users and Access → Integrations → Keys**,
create an **Apple Push Notification service (APNs)** key, download the `.p8`
once, and hand it to EAS:

```bash
cd mobile && eas credentials      # iOS → production → Push Notifications
```

The entitlement itself is already wired: `app.config.ts` sets `aps-environment`
from the environment, development by default, and `mobile/scripts/build-ipa.sh` sets
the production value for a store build.

## Testing without a device

`NOTIFY_TOKEN` set locally, and any publish returns `delivery.devices` — which
is `0` when nothing is subscribed. That distinguishes "the endpoint is wrong"
from "nobody is listening", which is the question you actually have at 11pm.

```bash
bun test src/lib/notify        # the request parser
```
