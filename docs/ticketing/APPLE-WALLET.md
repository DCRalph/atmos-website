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
