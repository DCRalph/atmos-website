# Apple Wallet pass updates

Passes stay current through Apple's web service at `/api/wallet/apple` plus an
APNs nudge whenever a **ticketed event** changes something printed on the pass.

Editing a linked gig (`/admin/gigs/...`) does **not** update ticket passes.
Gig title, time, and poster are a separate record. Change the ticketed event
under `/admin/events/[id]` for Wallet to follow.

## What triggers an update

- Event name, slug, doors/start time, timezone
- Venue name / address
- R18 flag
- Pass theme (strip style and colours)
- Event cancelled
- Ticket voided or refunded from admin

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
   email or `/tickets/[token]` page.
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
