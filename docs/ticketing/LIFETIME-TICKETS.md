# Lifetime tickets

A lifetime pass admits one named person to every Atmos event. It is issued
from `/admin/lifetime-tickets`, carries its own signed QR, and has a distinct
gold Apple Wallet pass.

## How it works at a door

A pass is not a `Ticket`. Its QR token is `atl1.<id>.<version>.<sig>`, hung
off `/events` as a fragment the same way a ticket token hangs off its event
page (`src/server/ticketing/qr.ts`).

The scanner (`scanTicket` in `src/server/ticketing/scan.ts`) recognises the
prefix, locks the pass row, checks the signature and that the pass is not
revoked, and then **mints an ordinary ticket for that event** on the first scan
of the night (`materialiseLifetimeTicket` in `src/server/ticketing/lifetime.ts`).
That ticket is linked back through `Ticket.lifetimeTicketId`, one per event,
in the holder's name and name-locked, on a zero-value `LIFETIME` order.

From there the decision is the same code path as any other ticket:
duplicate, re-entry, refusal, override, departure, headcount, door list and
timeline all just work. The admin's usage log is the scans of those tickets.

Consequences worth knowing:

- A pass consumes no tier allocation and no capacity. It never sells out.
- The level is copied onto the event ticket at mint. Changing a pass's level
  applies from the next event; past nights keep what they were let in on.
- Revoking a pass stops the QR scanning (`VOIDED`, "Lifetime pass revoked")
  and pushes a voided pass to any wallet holding it. Existing event tickets
  are left as history.
- Typing a pass number (`LT-XXXXXX`) into manual entry or the check tab works;
  the door router rebuilds the token from the number.

## The door screens

`ScanOutcome.lifetime` and `TicketCheck.lifetime` carry `{ number, holderName }`
whenever the scanned code was a pass, whether or not it reached a ticket. The
web scanner and the app both show a "LIFETIME PASS · LT-…" marker above the
ticket block, and `ticketTypeName` prints "Lifetime pass" wherever a tier name
would go.

## Wallet

`src/server/wallet/apple-lifetime.ts` builds the pass on the shared signing
and artwork pipeline with `LIFETIME_PASS_THEME` (gold bars on black). The band
carries the holder's name under a "LIFETIME PASS" label and the access chip.
Serials are `lifetime.<id>` so the existing web service at `/api/wallet/apple`
can tell the two tables apart; a revoked pass is served back marked `voided`.

Download route: `/api/lifetime/[id]/pkpass?t=<holder token>`.

## Delivery

The holder gets `/lifetime/[token]` (QR, level, wallet button) and an email
(`sendLifetimeEmail`). "Reissue code" rotates both the QR and the link and
pushes the new pass to the wallet.

## Smoke test

1. Issue a pass in admin with your own email. Open the email, add the pass to
   Wallet on an iPhone, and confirm it is gold with your name on the band.
2. At any published event, scan the wallet pass: green, "LIFETIME PASS"
   marker, name, level chip. Scan again: duplicate (or re-entry if enabled).
3. In admin, open the pass: the event and both scans are in the log.
4. Change the level: the wallet pass updates its chip within a minute.
5. Revoke: the wallet pass greys out, and a scan comes back "Lifetime pass
   revoked".
