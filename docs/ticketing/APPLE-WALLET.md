# Apple Wallet pass updates

Passes stay current through Apple's web service at `/api/wallet/apple` plus an
APNs nudge whenever a **ticketed event** changes something printed on the pass.

Editing a linked gig (`/admin/gigs/...`) does **not** update ticket passes.
Gig title, time, and poster are a separate record. Change the ticketed event
under `/admin/events/[id]` for Wallet to follow.

## What triggers an update

- Event name, slug, doors/start/end time, timezone
- Venue name / address
- R18 and re-entry flags
- Pass design (layout, artwork, colours, links, back rows, relevance)
- Event cancelled
- Ticket voided or refunded from admin

Editing the linked gig's run sheet does **not** push an update either, even
though the line-up and set times on the back come from it. They are read
fresh whenever a pass is built, so they catch up on the next push or re-add.

## Layouts

A design has a `layout`, picked on the event's Wallet tab and inherited per
level like everything else (`~/lib/ticketing/pass-design.ts`). The registry is
`PASS_LAYOUT_INFO` in `~/lib/ticketing/pass-theme.ts`; adding a layout is an
entry there, a branch in `getPassImages`, a branch in the builder and one in
the admin preview.

- **Band** (`BAND`): what shipped first. `strip.png` behind the title, the
  level chip on it, every iOS.
- **Blur** (`BLUR`): the poster as `background.png` (343 × 503 pt, which
  Wallet blurs) and `thumbnail.png` (90 × 90 pt) beside the title. No band,
  so no chip; the level reads through the access field.
- **Poster** (`POSTER`): the iOS 18 poster ticket. `preferredStyleSchemes`
  asks for it and the artwork ships at 358 × 448 pt. The band is still built
  and shipped, because a phone before iOS 18 falls back to the classic layout
  and needs it. The event name is always a primary field here: Wallet sets it
  over the artwork itself, so there is no chip and no name typeset into the
  band.

A layout that needs a poster but has none (nothing uploaded, no linked gig
with a poster, or the upload failed to load) is built as the band. The pass
only claims a poster it actually carries.

## Links, the back, and the phone

- **Event guide.** `PASS_GUIDE_LINKS` maps each admin field to the pass key
  Wallet draws a button from (parking, transit, food, bag policy,
  accessibility, add-ons, merch), plus venue phone, email and website as
  Contact venue and the address as Directions. Wallet shows the guide on a
  poster pass once two links are set. On the other layouts the same links are
  rows on the back.
- **Transfer** in a poster pass's menu opens the holder's own ticket page.
  **Sharing off** sets `sharingProhibited`.
- **Back.** Event name (when the front does not carry it), line-up and set
  times from the linked gig's run sheet (`~/lib/ticketing/pass-lineup.ts`),
  address, the organiser's own rows, ticket number, order, a Manage link, R18
  and terms. Wallet's data detectors are on, so addresses, numbers and links
  are tappable without being told.
- **Relevance.** `relevantDate` for phones before iOS 18 and `relevantDates`
  for the rest; with an end time on the event the entry is an interval, which
  on a poster pass is a live activity. Venue coordinates on the design become
  a `locations` entry with `maxDistance`.
- **Change messages** on doors, date and venue, so a push is also a
  notification. Off per design.
- **Semantics** always: event name and type, dates, venue, performers,
  admission level, attendee. The poster layout needs them to lay itself out.
- **App.** `APPLE_APP_STORE_ID` set, the pass offers to open the Atmos app.

Google Wallet gets the same inputs: guide links in the links module, custom
rows and the line-up as text modules, the poster as the hero image.

## The debugger

`/admin/wallet-debugger` builds a pass through the very same `composeApplePass`
a ticket goes through, from a sample night, a real event and level (with a
sample ticket), or a real ticket by number. The Look, Links, Back and Phone
tabs are the event editor's own, laid over the source's design as one more
layer; Fields, Semantics, Advanced and JSON edit the composed pass.json as a
patch (`applyPatch` in `~/lib/ticketing/wallet-pass-debug.ts`) that survives
the source recomposing under it. Every change recomposes on the server, which
also runs the pass library's validation and lists the bundle, so the status
line under the buttons is of the pass that would be signed. A sample pass has
no web service URL, so it never registers for updates; a real ticket's does,
and its QR admits.

## Not yet confirmed on a device

Apple's current guidelines name the poster artwork `artwork.png`; the pass
library's device-tested poster examples ship it as `background.png`, which is
what this does (`POSTER_ARTWORK_FILE` in `pass-images.ts`). Check on an iOS 18
phone that the poster draws, that an iOS 17 phone shows the band rather than a
blurred background, and that the live activity appears from doors. Bump
`PASS_TEMPLATE_UPDATED_AT` after any change here so passes already on phones
refresh.

## What the band carries

The strip is the band behind the top of the pass, and on a ticket above general
admission it carries the access chip — `AAA`, `VIP`, `CREW` — at the right.

Wallet draws a primary field across the whole width of that band, so on those
tickets the event name ran under the chip and the two collided. The name is
therefore typeset **into the artwork** beside the chip
(`src/server/wallet/pass-images.ts`), in the lane `stripTitleBox` leaves it, and
`primaryFields` is left empty so Wallet has nothing to draw on top.

Inside that lane the name is set as large as it will go: the size is found by
binary search over the rendered text rather than picked from a list, so a short
name fills the band and a long one wraps to two or three lines of the largest
type that still fits. Only a name that cannot be set even at the floor size —
one unbreakable word longer than the lane — is cut at a word and ellipsised,
and the full one is on the back of the pass.

General admission tickets have no chip and are untouched: the name stays a
Wallet field, in Wallet's type, scaling with the reader's text size.

If the text ever fails to rasterise — a font that cannot be written to `/tmp`,
say — nothing is drawn on the band and the primary field comes back, which is
also the only case where the old overlap could return. The chip fails the same
way, so in practice one goes with the other.

## Production smoke test

Needs a real iPhone, Wallet configured in env (`APPLE_PASS_*`,
`TICKET_QR_SECRET`, `NEXT_PUBLIC_APP_URL` matching the deployed host), and
`NODE_ENV=production` so APNs hits `api.push.apple.com`.

1. Buy or issue a test ticket. On the iPhone, add it to Apple Wallet from the
   email or `/tickets/[token]` page. Do it once per layout.
2. Confirm a `wallet_pass_registration` row exists for that ticket id.
3. In `/admin/events/[id]`, change doors time, then separately name, venue,
   pass theme, and R18. After each save, open Wallet (or wait a minute) and
   confirm the pass replaced in place — do not delete and re-add.
4. Cancel the event. The pass should show as expired.
5. Optional: refund or void the ticket and confirm the door QR no longer admits.

If the pass never moves:

- Check server logs for `[wallet] pass update push` / `had failures`.
- Confirm `NEXT_PUBLIC_APP_URL` is the public HTTPS origin baked into existing
  passes. Changing it after issue freezes those passes until they are re-added.
- Preview/staging with `NODE_ENV !== production` talks to APNs sandbox; a
  production-signed pass will not update there.
