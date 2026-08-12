# Comps and access levels — rebuild plan

Two problems with the comp system as it stands, and one design that fixes both.

## 1. What's wrong today

### A comp comes out of a tier, so you can only give away what you sell

`ticketAdmin.issueComps` (`src/server/api/routers/ticket-admin.ts:437`) takes tier
lines and hands them to `sellAtDoor`, which calls `createPendingOrder` →
`holdInventory` (`src/server/ticketing/box-office.ts:58`). That means:

- A comp consumes `soldCount` from a real tier. Giving an artist an AAA needs an
  AAA tier that exists and has stock left.
- There is no way to comp a level you don't sell. Nobody sells an AAA tier, so
  today the only route is to comp a GA ticket and then bump the level per-ticket
  after the fact (`comps-panel.tsx:355`) — a two-step workaround that leaves the
  ticket counted against the GA allocation forever.
- Event capacity is a hard error: `holdInventory` throws `EVENT_CAPACITY`
  (`src/server/ticketing/inventory.ts:294`). A comp that would put you one over
  the cap fails outright instead of asking.

### Nothing ties a ticket to a person, so the AAA is tradeable

A comp is a single order holding every ticket, and the `/tickets/[token]` link is
per-**order** (`src/server/ticketing/numbering.ts:62`). `findOrderByAccessToken`
returns every ticket on it (`orders.ts:558`), the page renders every QR
(`src/app/(main)/(tickets)/tickets/[token]/page.tsx`), and the details page lets whoever
holds the link put any name on any ticket
(`src/app/(main)/(tickets)/tickets/[token]/details/page.tsx:337`).

Comp Bob 1×AAA + 2×GA and he holds three interchangeable QR codes. He can keep a
GA, hand the AAA to a mate, and the door has no way to know.

## 2. The two rules the design has to enforce

1. **A comp ticket is minted, not drawn.** It belongs to no tier, consumes no
   allocation, and can be any access level whether or not a tier sells that
   level. Capacity only ever warns.
2. **A comp grant mints every ticket up front, and the recipient's own ticket
   carries their name, locked.** Bob's AAA says `BOB SMITH` and nobody holding
   the link can change it — only an admin. The other two are separate GA tickets
   Bob names and sends to whoever he likes, each with its own link.

Rule 2 is what kills the swap, and it does it without policing Bob: passing his
AAA on is _pointless_, because it turns up at the door in his name. The door
already prints `attendeeName` in 2xl bold on every scan
(`src/components/door/scan-result-screen.tsx:150`) — this design gives that
display teeth.

The level lives on the ticket from the moment it is minted. The only code path
that changes a level is the admin's `setTicketAccessLevel`
(`ticket-admin.ts:540`). Nothing in the hand-out flow touches it, so a GA handout
can never become an AAA.

## 3. Data model

```prisma
model Ticket {
  // was: tierId String
  tierId String?                    // null = minted, not drawn from a tier
  tier   TicketTier? @relation(...) // stays onDelete: Restrict for tier-backed

  /// Given away rather than sold. Distinct from `pricePaidCents == 0`, which a
  /// free tier also satisfies.
  isComp Boolean @default(false)

  /// Set once this ticket is in somebody's name for good. The holder of the
  /// link cannot change a locked name; an admin can. This is the whole
  /// anti-swap mechanism — Bob's AAA is locked at issue, a hand-out locks when
  /// it is sent, and *any* ticket locks the moment it is scanned in.
  nameLockedAt DateTime?

  /// Per-ticket link, mirroring `TicketOrder.accessTokenVersion`. A comp grant
  /// issues no order link at all: every person gets a link to their own ticket
  /// and nothing else. Bumping this revokes a link already sent.
  accessTokenVersion Int @default(1)

  /// A hand-out ticket points at the comp ticket it was granted alongside.
  hostTicketId String?
  hostTicket   Ticket?  @relation("CompHandout", fields: [hostTicketId], ...)
  handouts     Ticket[] @relation("CompHandout")

  /// Denormalised from `hostTicket.attendeeName` so the door can print who
  /// invited this person without a join on the scan path. Safe to copy because
  /// a host's name is locked at issue and never changes.
  invitedByName String?

  /// When the hand-out was actually sent, for "sent 12 Aug · Resend".
  sentAt DateTime?

  @@index([eventId, isComp, status])
  @@index([hostTicketId])
}
```

`TicketEmailType` gains `COMP` and `HANDOUT`.

Notes:

- **No comp "tier" rows.** The alternative — a hidden system tier per level —
  keeps `tierId` non-null but pollutes the tier manager, the analytics tier
  breakdown and the buy panel, and still needs inventory special-cased. Nullable
  `tierId` moves the cost to ~12 display sites (§8), all mechanical.
- **Every ticket is a real ticket from the moment the grant is made** — there are
  no placeholder or "promised seat" rows anywhere in this design. Capacity is
  therefore exact, the door list shows the full party immediately, and ticket
  numbers exist straight away.
- **Per-ticket tokens are derived, not stored**, exactly like order tokens:
  `<ticketId>.<hmac>` over id + `accessTokenVersion`, via a new
  `buildTicketAccessToken` beside `buildOrderAccessToken` (`numbering.ts:62`). No
  bearer secret in the database, links rebuildable for a resend.
- **Existing comps are left alone.** They have tiers and keep working as history;
  no backfill. Rewriting links people already hold isn't worth it.

## 4. Counting comps

Two numbers to stay on top of: how many seats are left in the room, and how many
tickets have been given away. Both are **soft** — they warn, they never block.

### The comp allowance

```prisma
model TicketEvent {
  /// How many comps this event is budgeted for. A target, not a limit: going
  /// over is allowed and only ever warns, because the call to comp one more
  /// person is made in the room and not by this column. Null means nobody set
  /// a number, so there's nothing to warn against — the count still works.
  compAllowance Int?
}
```

Set on the event form beside "Overall capacity" (`event-form.tsx:248`).

### One function, one set of numbers

Everything that displays or checks a comp figure reads `compAccounting(eventId)`
in `comps.ts`. One query source is the point — a panel, a confirm dialog and a
report that each do their own arithmetic will disagree eventually, and the first
you'll hear of it is at the door.

```ts
type CompAccounting = {
  // giveaway
  allowance: number | null; // the budget, null if unset
  issued: number; // valid comp tickets, hosts + hand-outs
  hosts: number; // named recipients (Bob)
  handouts: { total: number; sent: number; unsent: number };
  byLevel: Record<TicketAccessLevel, number>; // 3 AAA, 12 GUEST, …
  admitted: number; // comps that actually turned up
  overAllowanceBy: number; // 0 when within, else how far past

  // the room
  capacity: number | null;
  headcount: number; // Σ tiers(sold + held) + issued
  remainingForSale: number; // capacity - headcount, floored at 0
  overCapacityBy: number; // 0 when within, else how far past
};
```

### The identities that have to hold

Worth writing down, because these are what make the numbers checkable at a
glance and what the reconcile job asserts:

```
tickets issued   = Σ tier soldCount + comps issued
headcount        = Σ tier(soldCount + heldCount) + comps issued
seats left       = capacity  - headcount          // may go negative
comps left       = allowance - comps issued       // may go negative
gross revenue    = Σ paid order totals            // comps contribute 0, always
```

Comps never touch tier counters and never touch money, so any comp figure can be
added to or subtracted from a sales figure without double-counting. That is the
whole reason for keeping them off the tiers.

### Warning, not blocking

`issueComp` raises a typed `COMP_OVERAGE` carrying the accounting above plus
`reasons: ("ALLOWANCE" | "CAPACITY")[]`, and only when the caller hasn't passed
`acknowledge: true`. One flag rather than one per limit, so adding a third soft
limit later doesn't grow the API. The dialog names whichever tripped:

> This is 3 over your 20-comp allowance and puts you 5 over the 300 cap.
> Issue anyway? · **[Cancel]** **[Issue]**

Re-submitting with `acknowledge: true` always succeeds. There is no path in which
a comp is refused for either reason.

### Where it plugs in

- `inventory.ts` — add the comp term to the capacity check, exported as
  `eventHeadcount(tx, eventId)` and reused by `compAccounting`. Public checkout
  still throws `EVENT_CAPACITY` on the way past the cap; only comps get the soft
  treatment.
- `orders.ts:426 maybeMarkSoldOut` — same number, so comping the last seats flips
  the event to SOLD_OUT.
- `orders.ts:509 voidTicket` — skip `returnToStock` when `tierId` is null. A
  voided comp gives its seat back by dropping out of `issued`, which keeps the
  identities above true without a second code path.
- The nightly reconcile (`ticketing-sweep/route.ts:138`) gains a check that
  `Σ soldCount + comp count == valid ticket count` and logs drift, the same way
  it already does for tier counters.

## 5. Issuing a comp

New `src/server/ticketing/comps.ts`.

`issueComp({ eventId, recipientName, recipientEmail, accessLevel, handouts: [{ accessLevel, quantity }], notes, sendEmail, acknowledge, issuedByUserId })`

Bob is `accessLevel: AAA`, `handouts: [{ accessLevel: GENERAL, quantity: 2 }]`.

1. Inside `withEventInventoryLock` — for a consistent read; writes no tier
   counters.
2. Allowance and capacity check per §4 over `1 + Σ handout quantities` — the
   whole grant is weighed at once, so Bob's party of three is either warned about
   as three or not at all.
3. One `TicketOrder` as the container: `status: PAID`, `paymentMethod: COMP`, all
   totals 0, **no `items`**, `buyerName`/`buyerEmail` = recipient,
   `soldByUserId`, `paidAt`, `termsAcceptedAt`.
4. The host ticket: `tierId: null`, `isComp: true`, `accessLevel: AAA`,
   `attendeeName: "Bob Smith"`, **`nameLockedAt: now`**, `pricePaidCents: 0`.
5. Two hand-out tickets: same, but `accessLevel: GENERAL`, no name, no lock,
   `hostTicketId` = the host ticket, `guestOfName: "Bob Smith"`.
6. Outside the transaction: email Bob the `COMP` email — his ticket, his link,
   and the two he has to hand out.

None of this goes through `createPendingOrder`/`issueTicketsForOrder`; those are
the tier path and stay untouched.

## 6. Handing the spare tickets on

Bob's link is to **his ticket**, not to the order: `/t/[token]`. The page renders
one QR — his, with his name on it — and, because he holds the host ticket, a
"tickets to hand out" section listing the two GA tickets.

Per hand-out ticket, both routes (as chosen earlier):

- **Email** — Bob types a name and email → sets `attendeeName`, `attendeeEmail`,
  `nameLockedAt`, `sentAt`, and emails that guest a link to _their_ ticket.
- **Link** — "no email? copy a link" reveals that ticket's own `/t/[token]`. The
  guest opens it, puts their own name in once, and it locks.

Then the row reads `Jess Kaur · sent 12 Aug · Resend · Reassign`. **Reassign**
bumps that ticket's `accessTokenVersion` — killing the link already sent — clears
the lock, and starts again. It's the honest way to handle "she can't come now",
and it can't leak upward: the level was fixed at mint.

**Reassign dies at the door.** Once a ticket has been scanned in it is locked for
good (§7), so the row becomes `Jess Kaur · arrived 9:41pm` with no actions on it.
Somebody is already inside on that ticket; letting Bob rename it afterwards would
rewrite who that was.

Guests opening their own link see one QR and their name. No handout section,
because they hold no host ticket.

### Renaming guards (a hole in today's code, not just the new flow)

`tickets.saveDetails` (`tickets.ts:108`) and `tickets.setAttendeeNames`
(`tickets.ts:198`) currently let anyone holding an order link rename any ticket
on it. Both must reject tickets with `nameLockedAt` set, and both need to accept
a ticket token as well as an order token. Same for the details page UI
(`details/page.tsx:337`), which should render locked names as read-only.

## 7. Door

### Who invited them

`ScanOutcome.ticket` (`scan.ts:52`) gains `invitedByName`, read straight off the
denormalised column — no join on the scan path. When it's set, the result screen
prints **`Invited by Bob Smith`** under the level badge, on every result, admitted
or not. Door staff standing in front of somebody they don't recognise get the one
fact that settles it, and a guest claiming to be with an artist is either on that
artist's grant or isn't.

It goes in the same three places the attendee name already appears
(`scan-result-screen.tsx:150`, the duplicate/override screen at `:276`, and the
deny picker at `:118`), plus the door list and person sheet — a manager scrolling
the list should see the party grouped by who brought them.

### Locked on the way in

Admission locks the ticket. On the first admitting scan, set `nameLockedAt` if it
isn't already set, in the same transaction that writes the scan row
(`scan.ts`, the `ADMITTED` / `OVERRIDE_ADMITTED` path). The door's own
sell-and-admit shortcut writes scan rows directly (`door.ts:637`) and must do the
same.

After that the name is the record of who walked in: the holder can't change it,
reassign is gone from Bob's page (§6), and only an admin can correct it — logged,
as `setTicketAccessLevel` already is.

An unnamed hand-out that gets scanned in locks nameless. That's deliberate: it
stops a name being fitted to a ticket _after_ somebody used it. The scan log
still records the staff member, device and time, and an admin can add the name if
it's genuinely needed.

### The rest

- `ScanOutcome.ticket` also gains `nameLocked`. When true the result screen adds
  **"Photo ID — this ticket is in the name of Bob Smith"** under the name it
  already shows. Without this prompt the lock is decorative.
- Hand-out tickets that were never named scan fine and lead with
  `Guest of Bob Smith`.
- `positionInOrder` ("2 of 4") reads oddly for a grant — render it as
  `handout 2 of 2` when `hostTicketId` is set.
- The door's own comp flow (`door.ts:582`, manager-only gate at `:616`) takes
  `{ accessLevel, recipientName }` instead of tier lines and calls `issueComp`.
  `sell-panel.tsx` swaps the tier list for a level picker when COMP is selected,
  with the over-cap confirm inline. Cash and terminal sales are untouched.

## 8. Everything that reads `ticket.tier.name`

Add `ticketTypeName(ticket)` to `src/lib/ticketing/access-levels.ts`:
`ticket.tier?.name ?? accessLevel(ticket.accessLevel).label` — so a tier-less AAA
comp prints "Access all areas" wherever a tier name used to go.

| File                                                  | Lines                   |
| ----------------------------------------------------- | ----------------------- |
| `src/server/ticketing/scan.ts`                        | 55, 143, 194, 427, 501  |
| `src/server/api/routers/door.ts`                      | 422, 460, 497, 530, 686 |
| `src/server/api/routers/ticket-analytics.ts`          | 288, 453, 494           |
| `src/server/ticketing/email/send.ts` / `templates.ts` | 48, 91 / 27, 126, 240   |
| `src/server/wallet/apple.ts` / `google.ts`            | 27, 131 / 82            |
| `src/server/api/routers/tickets.ts`                   | 43                      |
| `src/server/api/routers/ticket-admin.ts`              | 131, 511                |

The nightly reconcile (`src/app/api/cron/ticketing-sweep/route.ts:144`) counts per
`tierId`, so null-tier tickets match no tier — no change needed.

## 9. Per-ticket links: the other things that assume an order token

- **Wallet passes.** `applePassUrl`/`googleWalletSaveUrl` (`urls.ts:31`) take an
  order token, and both routes scope the lookup to `orderId`
  (`pkpass/route.ts:41`). They need to accept a ticket token and scope to that
  one ticket instead.
- **Email.** `sendTicketEmail` is order-scoped and renders every ticket on the
  order (`send.ts:48`). Comps need a per-ticket send — `sendCompTicketEmail({
ticketId, type: "COMP" | "HANDOUT" })` — or Bob's email would contain all three
  QR codes and undo the whole design.
- **`ticketsUrl`** gains a `ticketUrl(ticketToken)` sibling for `/t/[token]`.

## 10. Where the numbers show up

All of these render `compAccounting` (§4) — none of them recompute anything.

- **Comps panel header** — an allowance meter: `18 / 20 comps · 2 left`, or
  `23 / 20 · 3 over` in amber. Underneath, the split that gets asked about:
  by level (`3 AAA · 12 GUEST · 8 GA`), and hand-outs `14 sent · 6 unsent`.
- **Event overview** (`event-overview.tsx:72`) — a `Comped` stat tile beside
  `Tickets sold`, subtitled against the allowance, so the front page of an event
  reads `240 sold · 20 comped · 40 left of 300`.
- **`analytics.overview.counts`** gains `comped`, `handoutsUnsent`,
  `compsAdmitted` and `compAllowance`. `ticketsIssued` already counts comps (it
  counts all VALID tickets), so the tier table needs a **"Comps — no tier"** row
  or its total won't match the headline.
- **`salesOverTime`** (`ticket-analytics.ts:195`) joins every ticket on a paid
  order — add `AND t."isComp" = false` so giveaways don't flatten the sales
  curve. Comps are a count, never a point on a revenue line.
- **Who gave them away** — comp orders already carry `soldByUserId`, and
  `ActivityType.TICKET_COMPED` is already logged. Group by issuer in the panel;
  it is the first question asked when the comp count looks wrong.
- **Attendees CSV** — `Tier` becomes `Type` via `ticketTypeName`, plus
  `Comp`, `Invited by` and `Level` columns so the door list reconciles offline.

## 11. Where this lives

Shipped as one change. The pieces, so the next person can find them:

| Concern                                                  | File                                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Minting, counting, hand-out assignment                   | `src/server/ticketing/comps.ts`                                                       |
| The migration                                            | `src/prisma/migrations/20260812000000_comp_tickets_and_levels/`                       |
| Capacity including comps                                 | `src/server/ticketing/inventory.ts` (`eventHeadcount`)                                |
| Per-ticket tokens                                        | `src/server/ticketing/numbering.ts`, `orders.ts` (`findTicketByAccessToken`)          |
| Type label for tier-less tickets                         | `src/lib/ticketing/access-levels.ts` (`ticketTypeName`)                               |
| The recipient's page and hand-out flow                   | `src/app/(main)/(tickets)/t/[token]/page.tsx`, `routers/tickets.ts`                   |
| Admin issuing, accounting, hand-out controls             | `routers/ticket-admin.ts`, `components/admin/ticketing/comps-panel.tsx`               |
| Door comping, `Invited by`, ID prompt, lock-on-admission | `routers/door.ts`, `ticketing/scan.ts`, `components/door/*`                           |
| Comp and hand-out email                                  | `ticketing/email/templates.ts` (`renderCompEmail`), `send.ts` (`sendCompTicketEmail`) |
| Wallet passes from either token kind                     | `src/server/wallet/pass-access.ts`                                                    |
| The reconcile assertion                                  | `src/app/api/cron/ticketing-sweep/route.ts` (`checkCompAccounting`)                   |

## 12. Worth knowing

- Comp orders carry **no `TicketOrderItem` rows**. Checked: nothing in the admin
  UI renders `order.items` — the order view lists `order.tickets` — so an empty
  items list is not a rendering case anywhere. Worth remembering before writing
  anything new that reads items.
- The allowance is one number for the event, not one per access level. Per-level
  budgets are a real thing some promoters want ("no more than 6 AAA") but they
  need a table rather than a column, and `byLevel` in the accounting already
  shows you the split — worth adding only if you find yourself wanting it.
- Admin keeps `setTicketAccessLevel` for bumping someone on the night, and
  `setTicketName` is the only way to rename a locked ticket. Both log to
  `ActivityLog`.
- A comp ticket goes into a wallet pass like any other; the pass shows the level
  label instead of a tier name.
- `maxTicketsPerOrder` and tier `maxPerOrder` don't apply to comps — they never
  touch `holdInventory`.
- Comps issued before this change are untouched: they were drawn from tiers, so
  they are not `isComp` and don't appear on the Comps tab. They still work, and
  they're under Orders filtered by the COMP payment method.
