# Atmos Ticketing — Build Plan

Status: **built**. Plan written 2026-08-11, implemented the same day.
Typechecks, lints and builds clean. Not yet deployed — see
"Changes made during the build" and "Before it can take money" at the bottom.

Ticketing for Atmos events: Stripe payments in NZD, QR entry, Apple + Google Wallet
passes, discount codes, tiered allocations, a door scanner, and live analytics —
with a checkout that asks for nothing but a payment method until after the money
has moved.

---

## 1. Decisions locked in

| Area | Decision |
| --- | --- |
| Event ↔ Gig | Separate `TicketEvent` model with an **optional** `gigId`. Gigs stay clean; non-gig events are possible. |
| Checkout | **Embedded** Stripe Payment Element on-site, with Express Checkout (Apple Pay / Google Pay / Link) buttons on top. |
| Identity | Guest checkout. Email comes from the wallet or the Payment Element. Details collected **after** payment. Permanent signed link emailed; a passwordless account is created quietly. |
| Wallet | **Apple + Google Wallet.** Requires an Apple Developer Program membership + Pass Type ID cert, and a Google Wallet issuer account + GCP service account. |
| QR | **Static, HMAC-signed opaque token.** First scan wins; later scans report how long ago. |
| Scanner | **Online-only** web scanner. Every scan hits the server, so duplicate detection is always correct. |
| Door access | Authenticated users assigned directly to an event through `TicketEventStaff`. |
| Re-entry | Warn loudly on a second scan (`ALREADY ADMITTED — 14 min ago`) with an **Admit anyway** override that is logged against the staff member. |
| Tiers | Per-tier allocation **+** optional sale window **+** manual on/off. Auto-advance when a tier sells out. Optional overall event capacity. |
| Free tickets | Per-tier: price 0 skips Stripe entirely and issues instantly, with a per-email cap. A tier can optionally require admin approval instead (guest list). |
| Fees | Booking fee configurable per event, with a site-wide default. Can be zero. |
| Refunds | Admin can refund a single ticket / whole order from the UI. Anything else is done in the Stripe dashboard and the site reacts to the webhook by voiding the ticket. **No** mass event-cancel refund in v1. |
| Money | **NZD only**, integer cents everywhere. |
| GST | Atmos is GST-registered. Displayed prices are **GST-inclusive**; receipts are valid taxable supply information. |
| Legal | NZ. Terms checkbox at checkout (versioned + stored). Per-event R18 flag **defaulting to true**. |
| Email | **Resend**, behind a provider interface, with a delivery log and a resend button. |

Explicitly **out of v1**, but the schema leaves room: waitlists, ticket transfer/resale,
mass cancel-and-refund, seat maps, multi-currency, offline scanning.

---

## 2. What the buyer experiences

1. **Event page** — `/events/[slug]`, and an embedded buy panel on `/gigs/[id]` when a
   gig is linked. Tiers with live remaining counts, "from $25 + $1.50 booking fee"
   shown up front (NZ drip-pricing rules — see §9).
2. **Pick tiers and quantities.** No account, no form, no email box.
3. **Pay.** A `PENDING` order is created server-side, inventory is held for 10 minutes,
   and the Payment Element mounts with Apple Pay / Google Pay on top. Wallet path is
   one tap and zero typing. Above the pay button: total breakdown, R18 notice, and the
   terms checkbox.
4. **Tickets exist immediately.** Redirect to `/tickets/[token]` where the QR codes are
   already live. Above them, a soft "Who's coming?" form for per-ticket attendee names —
   skippable, editable any time before the doors.
5. **Email** arrives with the QR codes attached inline, the permanent ticket link, and
   Add-to-Apple-Wallet / Add-to-Google-Wallet buttons.

The critical rule: **tickets are minted by the Stripe webhook, never by the browser
redirect.** The success page calls the same idempotent issuance function directly after
retrieving the PaymentIntent, so it feels instant, but the webhook remains the source of
truth if the user closes the tab.

---

## 3. Data model

New Prisma models, following existing conventions (PascalCase model, `@@map` to
snake_case). One deliberate deviation: **money is `Int` cents**, not the `Float` used by
the gear/rentals models. Floats and money don't mix, and this system issues receipts.

```prisma
enum TicketEventStatus { DRAFT PUBLISHED SALES_PAUSED SOLD_OUT CANCELLED ARCHIVED }
enum TicketOrderStatus { PENDING PAID FAILED EXPIRED CANCELLED REFUNDED PARTIALLY_REFUNDED }
enum TicketStatus      { VALID VOID REFUNDED }
enum TicketScanResult  { ADMITTED DUPLICATE OVERRIDE_ADMITTED INVALID_SIGNATURE NOT_FOUND WRONG_EVENT VOIDED REFUNDED_TICKET SALES_NOT_OPEN }
enum DiscountCodeType  { PERCENT FIXED }
enum PaymentMethodKind { STRIPE CASH TERMINAL COMP FREE }
enum TicketEmailType   { CONFIRMATION RESEND REFUND DETAILS_NUDGE REMINDER }
enum EventStaffRole    { SCANNER MANAGER }

model TicketEvent {
  id                String @id @default(cuid())
  slug              String @unique
  name              String
  gigId             String?          // optional link to an existing Gig
  gig               Gig?    @relation(fields: [gigId], references: [id], onDelete: SetNull)

  descriptionLexical Json?
  posterFileUploadId String?

  venueName         String?
  venueAddress      String?
  timezone          String  @default("Pacific/Auckland")
  doorsAt           DateTime?
  startsAt          DateTime
  endsAt            DateTime?

  status            TicketEventStatus @default(DRAFT)
  publishedAt       DateTime?
  salesOpenAt       DateTime?
  salesCloseAt      DateTime?

  capacity          Int?            // overall cap across tiers (null = tier sums only)
  maxTicketsPerOrder Int @default(10)
  requireAttendeeNames Boolean @default(true)
  reentryAllowed    Boolean @default(false)
  isR18             Boolean @default(true)

  // Fee + tax snapshot (falls back to site defaults when null)
  bookingFeeFixedCents Int?
  bookingFeePercentBp  Int?          // basis points
  gstRateBp            Int @default(1500)
  gstNumber            String?

  termsVersion      String  @default("v1")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tiers     TicketTier[]
  orders    TicketOrder[]
  tickets   Ticket[]
  scans     TicketScan[]
  staff     TicketEventStaff[]
  discountCodes DiscountCode[]

  @@index([status, startsAt])
  @@index([gigId])
  @@map("ticket_event")
}

model TicketTier {
  id           String @id @default(cuid())
  eventId      String
  event        TicketEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)

  name         String
  description  String?
  priceCents   Int     @default(0)      // 0 == free tier
  allocation   Int                        // tickets available in this tier
  soldCount    Int     @default(0)        // denormalised, maintained in txn
  heldCount    Int     @default(0)        // pending orders not yet expired

  salesStartAt DateTime?
  salesEndAt   DateTime?
  isActive     Boolean @default(true)     // manual kill switch
  isHidden     Boolean @default(false)    // code-unlocked / invite-only tiers

  maxPerOrder  Int     @default(10)
  maxPerEmail  Int?                       // enforced for free tiers especially
  requiresApproval Boolean @default(false)

  sortOrder    Int     @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tickets Ticket[]
  orderItems TicketOrderItem[]

  @@index([eventId, sortOrder])
  @@map("ticket_tier")
}

model TicketOrder {
  id           String @id @default(cuid())
  orderNumber  String @unique              // ATM-4F7K2X, no ambiguous chars
  eventId      String
  event        TicketEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)

  status       TicketOrderStatus @default(PENDING)

  buyerEmail   String?
  buyerName    String?
  buyerPhone   String?
  userId       String?                     // quietly-created passwordless account

  subtotalCents   Int @default(0)
  discountCents   Int @default(0)
  bookingFeeCents Int @default(0)
  totalCents      Int @default(0)
  gstCents        Int @default(0)          // component of totalCents, GST-inclusive
  currency        String @default("NZD")

  discountCodeId  String?
  paymentMethod   PaymentMethodKind @default(STRIPE)
  stripePaymentIntentId  String? @unique
  soldByUserId    String?                  // box office / comp

  termsAcceptedAt DateTime?
  termsVersion    String?
  marketingOptIn  Boolean @default(false)

  accessTokenHash String  @unique          // SHA-256 of the /tickets/[token] secret
  detailsCompletedAt DateTime?
  expiresAt    DateTime?                   // hold expiry while PENDING
  paidAt       DateTime?
  refundedCents Int @default(0)

  utmSource String?
  utmMedium String?
  utmCampaign String?
  ipAddress String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  items   TicketOrderItem[]
  tickets Ticket[]
  emails  TicketEmailLog[]
  redemptions DiscountRedemption[]

  @@index([eventId, status])
  @@index([buyerEmail])
  @@index([status, expiresAt])
  @@map("ticket_order")
}

model TicketOrderItem {
  id       String @id @default(cuid())
  orderId  String
  tierId   String
  quantity Int
  unitPriceCents Int                       // snapshot at purchase time
  order    TicketOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  tier     TicketTier  @relation(fields: [tierId], references: [id], onDelete: Restrict)

  @@unique([orderId, tierId])
  @@map("ticket_order_item")
}

model Ticket {
  id          String @id @default(cuid())
  ticketNumber String @unique              // ATM-4F7K2X-03
  orderId     String
  eventId     String
  tierId      String

  status      TicketStatus @default(VALID)
  attendeeName  String?
  attendeeEmail String?

  qrSecret    String                       // random 32 bytes, base64url
  qrVersion   Int @default(1)              // bump to invalidate (reissue/transfer)
  pricePaidCents Int @default(0)

  applePassSerial String? @unique
  googleObjectId  String? @unique

  voidedAt    DateTime?
  voidReason  String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  order  TicketOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  event  TicketEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  tier   TicketTier  @relation(fields: [tierId], references: [id], onDelete: Restrict)
  scans  TicketScan[]

  @@index([eventId, status])
  @@index([orderId])
  @@map("ticket")
}

/// Append-only. Powers "already admitted, 14 minutes ago" and the live door view.
model TicketScan {
  id        String @id @default(cuid())
  ticketId  String?
  eventId   String
  result    TicketScanResult
  wasOverride Boolean @default(false)
  scannedByUserId String?
  deviceLabel String?
  rawToken   String?                       // only stored for failed scans, for debugging
  createdAt DateTime @default(now())

  ticket Ticket      @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  event  TicketEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@index([eventId, createdAt])
  @@index([ticketId, createdAt])
  @@map("ticket_scan")
}

model TicketEventStaff {
  id       String @id @default(cuid())
  eventId  String
  userId   String
  role     EventStaffRole @default(SCANNER)
  createdBy String?
  createdAt DateTime @default(now())

  event TicketEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@unique([eventId, userId])
  @@map("ticket_event_staff")
}

model DiscountCode {
  id        String @id @default(cuid())
  code      String @unique                 // stored uppercase
  type      DiscountCodeType
  value     Int                            // percent basis points, or fixed cents
  eventId   String?                        // null = valid on any event
  tierIds   String[]                       // empty = all tiers
  maxRedemptions Int?
  maxPerEmail    Int? @default(1)
  minTickets     Int?
  redemptionCount Int @default(0)
  startsAt  DateTime?
  endsAt    DateTime?
  isActive  Boolean @default(true)
  unlocksHiddenTiers Boolean @default(false)
  createdBy String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  event       TicketEvent? @relation(fields: [eventId], references: [id], onDelete: Cascade)
  redemptions DiscountRedemption[]

  @@index([eventId, isActive])
  @@map("discount_code")
}

model DiscountRedemption {
  id       String @id @default(cuid())
  codeId   String
  orderId  String
  email    String?
  amountCents Int
  createdAt DateTime @default(now())

  code  DiscountCode @relation(fields: [codeId], references: [id], onDelete: Cascade)
  order TicketOrder  @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@unique([codeId, orderId])
  @@index([codeId, email])
  @@map("discount_redemption")
}

model TicketEmailLog {
  id       String @id @default(cuid())
  orderId  String?
  type     TicketEmailType
  toEmail  String
  providerMessageId String?
  status   String                          // sent | failed
  error    String?
  createdAt DateTime @default(now())

  order TicketOrder? @relation(fields: [orderId], references: [id], onDelete: SetNull)

  @@index([orderId])
  @@map("ticket_email_log")
}

/// Apple Wallet device registrations, so passes can be pushed updates
/// (time change, event cancelled, ticket voided).
model WalletPassRegistration {
  id String @id @default(cuid())
  deviceLibraryIdentifier String
  passTypeIdentifier      String
  serialNumber            String
  pushToken               String
  createdAt DateTime @default(now())

  @@unique([deviceLibraryIdentifier, serialNumber])
  @@index([serialNumber])
  @@map("wallet_pass_registration")
}
```

Also required:

- Door access is scoped exclusively through `TicketEventStaff`; there is no global door permission.
- `Gig` gains `ticketEvents TicketEvent[]` (back-relation). The existing `Gig.ticketLink`
  stays for externally-ticketed gigs; when a `TicketEvent` is linked it takes priority.
- `ActivityType` gains: `TICKET_EVENT_CREATED/UPDATED/DELETED/PUBLISHED/CANCELLED`,
  `TICKET_ORDER_PAID/REFUNDED`, `TICKET_ISSUED/VOIDED/RESENT`, `TICKET_SCANNED`,
  `TICKET_SCAN_OVERRIDE`, `DISCOUNT_CODE_CREATED/UPDATED/DELETED`, `DOOR_STAFF_ASSIGNED/REMOVED`.

### Preventing oversell

`soldCount` / `heldCount` on `TicketTier` are denormalised for fast public reads, and
maintained inside a transaction that takes `SELECT ... FOR UPDATE` on the tier row. Any
order creation:

1. Lazily expires stale `PENDING` orders for the event (`expiresAt < now()`) and
   decrements `heldCount`.
2. Locks the tier rows, checks `allocation - soldCount - heldCount >= qty`, and the
   event-wide `capacity` if set.
3. Creates the `PENDING` order + items, increments `heldCount`, sets a 10-minute
   `expiresAt`.

A Vercel cron every 5 minutes is the backstop sweeper, plus a nightly reconcile that
recomputes `soldCount` from the `Ticket` table and logs any drift.

---

## 4. QR tokens

Payload (not a URL — a random person scanning a screenshot with their camera app gets
nothing useful):

```
atm1.<ticketId>.<qrVersion>.<sig>
sig = base64url(HMAC-SHA256(TICKET_QR_SECRET, `${ticketId}.${qrVersion}`))[0..21]
```

- Compact, so it scans fast in bad light on a cheap phone screen.
- Signature is verified before any DB hit — bogus scans cost nothing.
- `qrVersion` bumps invalidate an old code without changing the ticket identity, which is
  what makes reissue and (later) transfer possible.
- `TICKET_QR_SECRET` is a new env var, independent of `BETTER_AUTH_SECRET` so it can be
  rotated separately. Rotation would invalidate live passes, so: generate once, treat as
  permanent, document it.

---

## 5. Door scanner

Route `/door` — outside the admin chrome. Dark, huge touch targets, one-handed.

- **Auth**: `DOOR_STAFF` (or `ADMIN`) via the existing better-auth login, plus a
  `TicketEventStaff` assignment for the specific event. Staff pick their event, then
  optionally set a device label ("Front door", "Side entrance") which is attributed to
  every scan.
- **Camera**: `getUserMedia` → decode with `BarcodeDetector` when available, falling back
  to a wasm decoder (`@zxing/browser` or `qr-scanner`) since iOS Safari has historically
  lacked `BarcodeDetector`. Feature-detect, never assume.
- **Fallbacks that matter at 11pm**: manual code entry for a cracked screen, and a
  searchable door list by name / order number / email.
- **Result states** — full-screen colour, distinct sound, haptic:
  - 🟢 `ADMITTED` — name, tier, "3 of 4 in this order".
  - 🟠 `ALREADY ADMITTED — 14 minutes ago` — who scanned it, on which device, plus the
    full entry history and an **Admit anyway** button that writes an
    `OVERRIDE_ADMITTED` scan against the staff member. (If the event has
    `reentryAllowed`, this is a calm green "Re-entry #2" instead.)
  - 🔴 `VOID` / `REFUNDED` / `WRONG EVENT` / `NOT A VALID TICKET`.
  - Any R18 event puts a persistent **R18 — CHECK ID** banner in the frame.
- **Race safety**: the admit is a conditional update inside a transaction, so two phones
  scanning the same QR simultaneously produce exactly one `ADMITTED`.
- Header shows a live `347 / 500 in` counter.

---

## 6. Analytics

**Live door view** — `/admin/events/[id]/live`, built to be watched on a phone during the
event. tRPC polling at ~5s (simple and reliable on Vercel; SSE/WebSockets are not worth
the operational cost here).

- Admitted vs sold vs capacity, as a big number and a bar.
- Arrivals per 5 minutes, and current arrival rate per minute.
- Scans by staff member / device.
- Live feed of the last ~30 scans, with overrides and failures highlighted.
- Not-yet-arrived count, and a one-tap door list.

**Sales analytics** — `/admin/events/[id]`:

- Gross, booking fees, Stripe fees, GST component, net.
- Tickets sold by tier, over time, with a cumulative sales curve against capacity.
- Discount code performance — redemptions, revenue given away, per code.
- Funnel: event page views (PostHog) → checkout started → paid, with drop-off.
- UTM breakdown, captured at order creation.
- Refunds, comps, and box-office splits by payment method.
- Post-event: attendance rate (scanned / sold), arrival curve, no-show list.
- CSV exports: door list, attendees, sales, scan log.

Charts follow the `dataviz` skill when built.

---

## 7. Wallet passes

**Apple** (`.pkpass`) is the larger chunk of work:

- Needs Apple Developer Program membership, a **Pass Type ID certificate** (.p12) and the
  Apple WWDR intermediate cert, both stored base64 in env vars.
- `passkit-generator` on the **Node runtime** (not Edge): zip of `pass.json`, images,
  `manifest.json`, and a detached PKCS#7 signature.
- Served from `/api/tickets/[ticketId]/pkpass?t=<signed token>`.
- Set `webServiceURL` + `authenticationToken` from day one, and implement the Apple
  web service endpoints (`register`, `unregister`, `passes`, `log`) backed by
  `WalletPassRegistration`. Skipping this makes passes permanently static — no way to
  push a time change or a cancellation. Push updates go via APNs using the same cert.
- **The cert expires annually.** Add an admin warning at 30 days and a calendar reminder;
  an expired cert means nobody can add a pass.

**Google Wallet** is simpler: a GCP service account + Wallet API issuer account, one
`EventTicketClass` per event, then a signed JWT save link per ticket.

Both use the same QR payload as the email and the web ticket page.

---

## 8. Email

- New `src/server/email/` with a provider interface. Resend becomes the transactional
  path; the existing `sendEmail()` (contact form, newsletter) is left alone initially and
  can migrate later.
- QR codes are generated server-side as PNGs and attached **inline (CID)**. Many clients
  block remote images, and a blocked QR is a person stuck outside. Always include the web
  ticket link and both wallet buttons as a backup.
- Templates: order confirmation with tickets, free-ticket issued, refund confirmation,
  attendee-details nudge, optional day-before reminder.
- Every send is written to `TicketEmailLog`; admin gets a **Resend tickets** button and
  can see failures.
- **Marketing consent is a separate opt-in checkbox** at checkout — ticket buyers are not
  auto-subscribed to the newsletter (Unsolicited Electronic Messages Act 2007).
- Requires SPF/DKIM/DMARC on the sending domain before launch. Non-negotiable for tickets.

---

## 9. NZ legal / compliance setup

Not legal advice — worth a quick confirmation with your accountant, especially on GST.

- **GST (15%)** — Atmos is registered, so displayed ticket prices are GST-inclusive. The
  GST component of a GST-inclusive total is `total × 3 ÷ 23`. Receipts must be valid
  *taxable supply information*: supplier name, GST number, date, description of supply,
  amount, and GST. `gstRateBp` and `gstNumber` are snapshotted onto the order so historical
  receipts stay correct if either changes.
- **Fair Trading Act 1986** — the Commerce Commission actively pursues "drip pricing". The
  booking fee must be visible on the event page and in the summary *before* the pay
  button, not revealed at the last step. Advertise all-in where practical.
- **Privacy Act 2020** — a collection notice at the point where the email is captured
  (IPP 3), linking to an updated `/privacy` that names Stripe, Resend, AWS and Google as
  processors and covers offshore disclosure (IPP 12). Add a retention period for attendee
  data and a deletion path. Be ready for the mandatory breach-notification duty.
- **R18** — per-event flag, defaulting **true**. Shown at checkout with an
  acknowledgement, printed on the ticket, and flagged in the scanner so door staff know to
  check ID. If the venue is licensed, the venue's own obligations under the Sale and
  Supply of Alcohol Act 2012 still apply — the flag is a prompt, not a substitute.
- **Terms of ticket sale** — a `/tickets/terms` page, versioned; `termsVersion` and
  `termsAcceptedAt` stored per order. Should state the refund position plainly: no
  change-of-mind refunds, but cancelled or materially changed events are refunded.

---

## 10. File layout

```
prisma/schema.prisma                      # + models above, DOOR_STAFF, ActivityType additions

src/server/ticketing/
  money.ts            # cents maths, GST component, booking fee, formatting
  qr.ts               # sign / verify / parse the ticket token
  inventory.ts        # locked availability checks, hold + release
  orders.ts           # create pending, idempotent issuance, refund handling
  discounts.ts        # validate + apply + redeem
  numbering.ts        # order / ticket number generation
  scan.ts             # the admit transaction
  analytics.ts        # aggregation queries for both dashboards
src/server/stripe.ts                      # Stripe client
src/server/email/
  provider.ts, resend.ts, templates/*.tsx
src/server/wallet/
  apple.ts, google.ts, images/
src/server/api/routers/
  ticket-events.ts    # admin CRUD, publish, staff assignment
  ticket-checkout.ts  # public: availability, create order, apply code, confirm
  tickets.ts          # public: view by token, set attendee names, resend
  door.ts             # scanner: event list, scan, override, door list, live stats
  ticket-analytics.ts # admin dashboards + exports
  discount-codes.ts   # admin CRUD

src/app/api/webhooks/stripe/route.ts      # Node runtime, raw body, signature verified
src/app/api/tickets/[ticketId]/pkpass/route.ts
src/app/api/wallet/apple/v1/[...path]/route.ts
src/app/api/cron/ticketing-sweep/route.ts

src/app/(main)/events/page.tsx            # what's on
src/app/(main)/events/[slug]/page.tsx     # event + buy panel
src/app/(main)/tickets/[token]/page.tsx   # tickets + details form (noindex)
src/app/(main)/tickets/terms/page.tsx

src/app/(door)/door/...                   # scanner, own minimal layout

src/app/(admin)/admin/events/...          # list, [id] dashboard, tiers, orders,
                                          # attendees, live, staff, box-office
src/app/(admin)/admin/discount-codes/...

src/components/ticketing/*                # buy panel, tier picker, checkout, ticket card
src/components/door/*                     # camera, result screens, door list
```

`vercel.json` gets created for the cron entries (there isn't one yet).

New env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `TICKET_QR_SECRET`, `RESEND_API_KEY`,
`APPLE_PASS_CERT_P12_BASE64`, `APPLE_PASS_CERT_PASSWORD`, `APPLE_WWDR_CERT_BASE64`,
`APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`, `GOOGLE_WALLET_ISSUER_ID`,
`GOOGLE_WALLET_SERVICE_ACCOUNT_JSON`, `CRON_SECRET` — all added to `src/env.js` and
`.env.example`.

---

## 11. Phases

Each phase ends in a working, shippable state. Everything sits behind a
`ticketing.enabled` feature flag (the existing `KeyValueStore` pattern) until phase 7.

| # | Phase | Contents |
| --- | --- | --- |
| 0 | Foundations | Schema + migration, per-event staff assignments, env vars, Stripe account in test mode, money/QR/numbering utils with tests. |
| 1 | Admin + public event pages | Event and tier CRUD, poster upload via the existing preset system, gig linking, public `/events` and `/events/[slug]`, buy panel on gig pages. No sales yet. |
| 2 | Checkout | Inventory holds, embedded Payment Element + express buttons, webhook, idempotent issuance, `/tickets/[token]`, post-payment attendee names, confirmation email with QR + wallet links. **The core.** |
| 3 | Codes, free tiers, box office | Discount codes with all their limits, free/instant tiers, approval tiers, admin box-office issuance (cash / terminal / comp), single-ticket refunds + refund webhook handling. |
| 4 | Door | Staff assignment, `/door` scanner with camera + fallbacks, scan transaction, result states, override logging, door list, live counter. |
| 5 | Wallet | Apple `.pkpass` + web service + APNs updates, then Google Wallet. |
| 6 | Analytics | Live door dashboard, sales dashboard, CSV exports. |
| 7 | Launch | Terms + privacy updates, GST receipts, cron sweepers, deliverability setup, rate limiting, load test, Stripe live keys, flag on. |

Phase 2 is the one that matters; 0–2 is a usable ticketing system. 4 is required before
any real event. 5 is the most likely to slip on external dependencies (Apple certs,
Google issuer approval) — start those account applications during phase 0 because the
approvals take days, not minutes.

---

## 12. Risks

| Risk | Mitigation |
| --- | --- |
| Overselling under a rush | Locked tier rows + held inventory + nightly reconcile. Load-test a 200-concurrent-buyer burst before launch. |
| Webhook lag or loss | Idempotent issuance callable from both webhook and success page; reconcile cron that retries `PENDING` orders whose PaymentIntent actually succeeded. |
| Ticket email in spam | Resend + SPF/DKIM/DMARC, inline QR attachments, delivery log, resend button, and the ticket link works without email. |
| iOS camera / decoder | Feature-detect `BarcodeDetector`, ship a wasm fallback, and always keep manual entry + name search available. |
| Apple cert expiry | Annual renewal; admin warning at 30 days out. |
| Timezone / DST | Store UTC, render in `Pacific/Auckland`. Sale windows and analytics buckets both need the event timezone, and NZ DST shifts will bite otherwise. |
| Discount code brute force | Rate-limit code validation and order creation (DB-backed counter — in-memory doesn't work on serverless). |
| Test/live key mixups | Separate keys per environment, and a loud non-production banner anywhere money appears. |

---

## 13. Things worth deciding before phase 2

Sensible defaults are assumed for all of these; flag any you want changed.

1. **Hold duration** — 10 minutes assumed.
2. **Max tickets per order** — 10 assumed.
3. **Ticket naming** — one QR per ticket (not per order) assumed, so groups can arrive separately.
4. **Sold-out behaviour** — show "Sold out" with no waitlist in v1.
5. **Day-before reminder email** — build it, off by default per event?
6. **Comp tickets** — issued via box office with a `COMP` payment method; no separate flow.
7. **Refund of booking fee** — assumed refunded along with face value on a full refund.
8. **Order edits** — admin can void a ticket and reissue; no quantity edits on a paid order.
9. **Apple/Google Wallet accounts** — who applies? These need to start early.
10. **PostHog** — reuse the existing install for funnel events rather than adding tracking.

---

## 14. Changes made during the build

Four things came out differently from the plan above. All deliberate.

**Ticket links are derived, not stored.** The plan had `accessTokenHash` — a
SHA-256 of a random secret. That is more secure but it makes "resend my tickets"
impossible, because we'd have no way to rebuild the link. Replaced with
`accessTokenVersion`: the token is `<orderId>.<HMAC(secret, id + version)>`, so
it can be regenerated on demand, no bearer secret sits in the database, and
bumping the version revokes a leaked link (there's a "Rotate link" button in the
admin order view).

**The QR signature covers the ticket's own secret.** The plan verified the
signature before touching the database. Since scanning ended up online-only
anyway, the signature now also covers the per-ticket `qrSecret`, which means a
leaked `TICKET_QR_SECRET` alone is not enough to forge a ticket — you'd need the
per-ticket secret out of the database too. Costs one lookup we were making
regardless.

**Apple certificates are supplied as PEM, not `.p12`.** `passkit-generator`
wants PEM, so the env vars are `APPLE_PASS_CERT_PEM_BASE64` /
`APPLE_PASS_KEY_PEM_BASE64` / `APPLE_WWDR_PEM_BASE64`. `.env.example` has the
two `openssl` commands that split Apple's `.p12` into those.

**Added `ADMISSION_REVERTED`.** Door managers need to undo a mistaken admission.
The scan log stays append-only — an undo is a new row, and the admitted count
only counts admissions with no later revert.

---

## 15. Before it can take money

In rough order:

1. `bun db:push` — the schema is additive (new tables, new enum values, one new
   column on nothing existing) but it has not been applied to any database yet.
2. Set `TICKET_QR_SECRET`. Generate once, never rotate:
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
3. Stripe test keys + `stripe listen --forward-to localhost:3000/api/webhooks/stripe`,
   then run a full test purchase end to end.
4. Resend API key, and SPF/DKIM/DMARC on the sending domain.
5. Admin → Settings → Ticketing: GST number, legal name, support email, booking fee.
6. Apple Developer: create a Pass Type ID, export the certificate, run the
   `openssl` commands in `.env.example`.
7. Google Cloud: service account + Google Wallet issuer account.
8. `CRON_SECRET`, and confirm the Vercel cron in `vercel.json` is running.
9. Assign someone to a test event as door staff; run a real scan on a real
   phone.
10. Swap to Stripe live keys.
