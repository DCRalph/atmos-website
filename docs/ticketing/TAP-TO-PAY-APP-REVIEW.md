# Tap to Pay on iPhone — Apple App Review readiness plan

Against **App Review Requirements Checklist v1.6** (March 2026), `docs/App
Review Requirements Checklist 1_6.xhtml`.

This is the work needed before the checklist can be filled in honestly and
emailed to Apple. It is also, in practice, what unlocks the **distribution**
entitlement — `TAP-TO-PAY.md` records that Apple granted development only, and
this review is the gate for the rest.

---

## The shape of this app, and what it does to section 2

Apple's checklist assumes a payment service provider whose app onboards many
third-party merchants. Atmos is the opposite, and the whole of section 2 turns
on saying so plainly:

- **Atmos is a single merchant.** One Stripe account, one legal entity, in NZ.
  Nobody else can become a merchant through this app — there is no code path
  that would let them, and there never will be.
- **The app is a consumer ticketing app** on the public App Store. Punters buy
  tickets and hold them in the wallet. Tap to Pay is an internal box-office tool
  for Atmos's own door staff, gated behind `doorProcedure` and re-checked
  server-side on every call.
- **Merchant onboarding happened once, out of band**, when the Stripe account
  was opened. It is not repeatable and not in the app.

That gives these answers:

| Row | Answer |
| --- | --- |
| 2.1 | Satisfied by a discoverable **Tap to Pay on iPhone** row in *More*, which explains that access is granted by Atmos and how to ask for it. See Phase 3. |
| 2.2 | **N/A — single-merchant closed-loop app.** No third-party merchant onboarding exists. |
| 2.3 | **N/A**, same reason. Staff go from "granted door access" to "taking a tap" in well under 15 minutes; that is what the New User Flow recording will show. |
| 3.4 | **N/A** — no merchant onboarding to end. Replaced by the first-run splash and enable flow that fires when a user is first granted door access (Phase 6). |
| 3.8.2 | **N/A** — public App Store distribution, not Custom, Unlisted, or Enterprise. Apple Business Connect acceptance is not required. |

Everything else in the checklist applies in full. Staff-only does **not** excuse
sections 1, 3, 4, 5 or 6 — Apple cares that the merchant-facing experience is
correct, and the door staff *are* the merchant-facing users.

**Recording note.** The "New User Flow" recording becomes the *new staff member*
flow: a user is granted door access → sees the launch splash → opens Tap to Pay
in settings → an admin accepts the Terms and Conditions → education screens →
configuration progress → completion. The checklist explicitly allows this
("If your app does not provide a path for a new user to onboard within the app
provide details on how new users onboard to become merchants").

---

## Where the app stands today

Read: `mobile/src/components/door/tap-to-pay.tsx`, `.../terminal.tsx`,
`mobile/app/(door)/[eventId]/sell.tsx`, `src/server/api/routers/terminal.ts`.

| # | Requirement | State |
| --- | --- | --- |
| 1.1 | iPhone XS+ support | ⚠️ `supportsReadersOfType` gates it, but every failure collapses into one generic "unavailable" message |
| 1.2 | Deployment target | **N/A** — Tap to Pay is not the primary payment method (online Stripe checkout is; cash and eftpos are the other door methods) |
| 1.3 | A12 / `UIRequiredDeviceCapabilities` | **N/A**, same condition. Deliberately *not* adding the A12 requirement — it would lock consumers with older iPhones out of a ticketing app over a staff feature |
| 1.4 | `osVersionNotSupported` handling | ❌ nothing checks the iOS version |
| 1.5 | Warm up at launch / foreground | ❌ the SDK initialises only on entering door mode; discovery and connect wait until the sell sheet opens |
| 1.6 | Read acceptance status from Apple | ❌ never asked for; also never cached, so nothing to unwind |
| 1.7 | Face ID / Touch ID login | ❌ absent |
| 1.8 | Human Interface Guidelines | ⚠️ custom sheet, mostly sound; wrong button copy and no SF Symbol |
| 1.9 | Developer Marketing Guidelines | ⚠️ the button says "Tap" |
| 3.1 | Visible, discoverable communication | ❌ nothing outside the sell screen |
| 3.2 | Full-screen splash | ❌ |
| 3.3 | Communicate to eligible users once | ❌ |
| 3.5 | Clear action to accept T&C | ❌ acceptance would be triggered implicitly by the first `connectReader` |
| 3.6 | Enable outside checkout | ❌ no settings entry |
| 3.7 | Enable trigger in checkout | ⚠️ button exists but vanishes when unavailable |
| 3.8 | T&C only by an authorized party | ❌ `tosAcceptancePermitted` never set |
| 3.8.1 | "Contact an admin" message | ❌ |
| 3.9 | "Try it out" screen | ❌ |
| 3.9.1 | Configuration progress indicator | ❌ `onDidReportReaderSoftwareUpdateProgress` unwired |
| 4.1 | `ProximityReaderDiscovery` | ❌ **not exposed by the Stripe RN SDK** — needs a native module (see Phase 2) |
| 4.2 | Education after T&C | ❌ |
| 4.3 | Education in Settings/Help | ❌ |
| 4.5–4.8 | Cards, wallets, PIN, fallback | ❌ |
| 5.1 | Prominent checkout button | ✅ |
| 5.2 | Top of list, no scrolling | ❌ Tap is **last** of three, below a scrollable tier list |
| 5.3 | Never hidden or greyed | ❌ `tapAvailable` hides it outright — a direct violation |
| 5.4 | Correct copy | ❌ reads "Tap" |
| 5.5 | `wave.3.right.circle` SF Symbol | ❌ |
| 5.6 | UI within 1s, 90% of taps | ❌ no warm-up, so first tap pays for discovery + connect |
| 5.7 | "Initializing" screen | ⚠️ a spinner, not tied to real configuration state |
| 5.8 | Processing screen | ✅ |
| 5.9 | Approved / declined / timed out | ⚠️ approved is clear; the other two are one generic error box |
| 5.10 | Digital receipt either way | ❌ nothing captures customer contact at a door sale |
| 5.11 | Regional (NZ) | ⚠️ PIN is supported in NZ on iOS 16.4+ and must be covered in education |
| 6.1–6.3 | Launch email, splash, push | ❌ |

The honest summary: **the payment itself is correct and the surrounding
merchant experience is missing.** The order of operations in `tap-to-pay.tsx` —
hold stock, open the intent, tap, re-read from Stripe server-side, only then
mint — is the hard part and it is already right. Almost everything below is
merchant-facing UI and lifecycle.

---

## Decisions taken

- **Receipts (5.10):** optional email on the result screen via the existing
  ticketing email infrastructure, plus the native iOS share sheet.
- **T&C authority (3.8):** **admin only.** Event organisers and per-event door
  managers get the 3.8.1 "contact an admin" message. Accepting links Atmos's
  merchant ID to that person's Apple Account, which is a directorial act, not an
  operational one.
- **Marketing (3.2/3.3/6.x):** build the plumbing now with structurally correct
  copy and a marked placeholder artwork slot; official Hero assets and approved
  copy drop in before submission.

---

## Phase 0 — Dependencies and config

`mobile/package.json`

- `expo-symbols` — SF Symbols, for `wave.3.right.circle.fill` (5.5).
- `expo-local-authentication` — Face ID / Touch ID (1.7).

`mobile/app.config.ts`

- `ios.infoPlist.NSFaceIDUsageDescription` — "Atmos uses Face ID to unlock door
  mode on this handset."
- Leave `UIRequiredDeviceCapabilities` alone, and leave the deployment target
  alone. Record *why* in the config comment: 1.2 and 1.3 are conditional on Tap
  to Pay being the primary payment method, and it is not.
- Keep `supportsTablet: false` (already set — iPad cannot do Tap to Pay).

---

## Phase 1 — Tap to Pay lifecycle

The centre of the work. New file `mobile/src/lib/tap-to-pay.tsx`, absorbing and
replacing `mobile/src/components/door/terminal.tsx`.

### One state machine, read from the SDK

```ts
type TapToPayState =
  | { status: "ineligible" }                                    // not staff
  | { status: "unsupported"; reason: UnsupportedReason; message: string }
  | { status: "initializing" }
  | { status: "needs-terms"; canAccept: boolean }
  | { status: "configuring"; progress: number | null }
  | { status: "ready" }
  | { status: "error"; message: string };
```

**Nothing here is persisted, and acceptance is never stored as a boolean
(1.6).** `needs-terms` is derived on every evaluation from the SDK's own
response to a `tosAcceptancePermitted: false` connect — Apple is the source of
truth, and the app asks it again each launch.

### Warm-up at launch and foreground (1.5, 5.6)

Move `DoorTerminalProvider` from `mobile/app/(door)/_layout.tsx` up into
`mobile/src/components/providers.tsx` so it is alive from app launch. Bootstrap
is gated on `door.myEvents` succeeding, so a punter never mints a connection
token and never sees a Terminal call.

For eligible staff, on launch and on every `AppState` transition to `active`:

1. `initialize()`
2. `supportsReadersOfType({ deviceType: "tapToPay", discoveryMethod: "tapToPay" })`
3. `discoverReaders({ discoveryMethod: "tapToPay" })`
4. `connectReader({ discoveryMethod: "tapToPay", reader, locationId,
   merchantDisplayName: "Atmos", tosAcceptancePermitted: false,
   autoReconnectOnUnexpectedDisconnect: true })`

`tosAcceptancePermitted: false` on the *background* path is the load-bearing
detail. Without it, the first launch on a fresh handset would throw Apple's
Terms and Conditions sheet at whoever opened the app, unprompted, with no
authorization check — failing 3.5 and 3.8 simultaneously. With it, connect
fails cleanly, we learn acceptance is outstanding, and the sheet only ever
appears from a deliberate admin action.

By the time anyone reaches checkout the reader is already connected, which is
what buys 5.6's one-second budget.

### Configuration progress (3.9.1, 5.7)

Wire the `useStripeTerminal` callbacks that are already available and unused:

- `onDidReportReaderSoftwareUpdateProgress` → `configuring.progress`
- `onDidStartInstallingUpdate` / `onDidFinishInstallingUpdate` → enter and leave
  `configuring`
- `onDidChangeConnectionStatus` → drives `initializing` ⇄ `ready`
- `onDidAcceptTermsOfService` → the signal that fires education (4.2) then the
  "try it out" invite (3.9)

### Error mapping (1.4, 1.1)

A single `describeTapToPayError()` that turns SDK codes into something a person
at a door can act on, replacing today's one-size-fits-all string:

| Condition | Message |
| --- | --- |
| `Platform.Version < 17.6` | "Update this iPhone to the latest iOS to take card payments." — **this is 1.4**, checked before any SDK call so it lands even when the SDK refuses to start |
| `TAP_TO_PAY_UNSUPPORTED_DEVICE`, `TAP_TO_PAY_UNSUPPORTED_PROCESSOR` | "This iPhone can't take Tap to Pay. It needs an iPhone XS or later." |
| `TAP_TO_PAY_DEVICE_TAMPERED`, `TAP_TO_PAY_INSECURE_ENVIRONMENT` | "This iPhone isn't secure enough to take payments." |
| `TAP_TO_PAY_READER_MERCHANT_BLOCKED` | "Card payments are blocked on this account. Contact Atmos." |
| T&C outstanding | → `needs-terms`, not an error |
| network / token | retryable `error` |

`MIN_TAP_TO_PAY_IOS` gets its own exported constant with a comment pointing at
Apple's Business Register, which is where the real floor moves.

### Brand the Apple sheet (1.8)

Call `setTapToPayUxConfiguration({ darkMode: "dark", colors: … })` once after
initialize, so Apple's payment sheet matches the app's forced-dark theme instead
of flashing white at a dark door.

### Server

`src/server/api/routers/terminal.ts` — extend `config` to return
`canAcceptTerms`, resolved from `userHasPermission(user, "ADMIN")`. The app must
never decide this for itself.

---

## Phase 2 — `ProximityReaderDiscovery` native module (4.1)

**Required, and the Stripe React Native SDK does not expose it.** Confirmed by
reading `@stripe/stripe-terminal-react-native@0.0.1-beta.32`: the iOS bridge
touches `TapToPayDiscoveryConfiguration` only, and there is no `presentEducation`
or `content(for:)` anywhere in `ios/`. Stripe's own docs say to call Apple's API
directly — the framework is already linked by the Terminal SDK, so this adds no
new dependency.

Getting 4.1 right also discharges **4.4, 4.6, 4.7 and 4.8** in one move, per the
checklist's own note.

New local Expo module — local rather than a config plugin patch because
`mobile/ios` is generated by `expo prebuild` and gitignored, so anything written
into it by hand is destroyed on the next build:

```
mobile/modules/proximity-education/
  expo-module.config.json
  index.ts
  ios/ProximityEducationModule.swift
```

The Swift side, following Apple's two-step pattern:

```swift
guard #available(iOS 18.0, *) else { return false }
let discovery = ProximityReaderDiscovery()
let content = try await discovery.content(for: .payment(.howToTap))
var top = rootViewController
while let presented = top.presentedViewController { top = presented }
discovery.presentContent(content, from: top)
```

Two traps, both documented by Stripe and both fatal if missed:

- Guard on `#available(iOS 18.0, *)` and fall back to our own screens (Phase 3).
- Pass the **topmost presented** view controller, walking the
  `presentedViewController` chain. Passing the root while a modal is up makes
  the call fail silently — and our sell flow is a full-screen modal, so this is
  the normal case here, not the edge case.

TypeScript surface: `isEducationAvailable(): boolean` and
`presentHowToTap(): Promise<void>`.

---

## Phase 3 — Education and settings screens

New route group `mobile/app/(door)/tap-to-pay/`:

**`index.tsx` — the Tap to Pay hub (3.1, 3.6, 4.3)**

Reachable from *More* → "Tap to Pay on iPhone" for any door staff, and from the
door picker. This is the screen that satisfies "enable outside of the usual
communications and checkout flow". It shows live state from Phase 1:

- `needs-terms` + admin → **Set up Tap to Pay** (3.5). Connects with
  `tosAcceptancePermitted: true`, which is the only place in the app that is
  ever true.
- `needs-terms` + not admin → "An Atmos admin needs to accept the Tap to Pay on
  iPhone Terms and Conditions on this iPhone before it can take card." (**3.8.1**)
- `configuring` → progress indicator (3.9.1)
- `ready` → status, plus **How to take a payment** and **Take a test payment**
- `unsupported` → the specific reason from Phase 1

**`education.tsx` (4.2, 4.5, 4.6, 4.7, 4.8)**

On iOS 18+, calls `presentHowToTap()` from Phase 2. On iOS 17.x, renders our own
screens — required as the fallback, and they must cover:

- holding a **contactless card** to the top of the phone (4.5)
- **Apple Pay, Google Pay and other wallets** (4.6)
- **PIN entry** — NZ supports it on iOS 16.4+, so this is not optional here —
  including the accessibility options on Apple's PIN screen (4.7)
- **fallback** when a card will not read: take cash or eftpos and record the
  sale, which the sell screen already supports (4.8)

Shown automatically after `onDidAcceptTermsOfService` (4.2) and reachable
permanently from the hub (4.3).

**`try-it.tsx` (3.9)**

After education completes, invite a real test tap. Recommended, not required —
worth having because it is also the cleanest thing to put in the Apple
recording.

**`mobile/app/(tabs)/more.tsx`** — add the "Tap to Pay on iPhone" row, visible to
staff. For non-staff it explains that Tap to Pay is Atmos box-office tooling and
how to ask for access, which is what carries 2.1.

---

## Phase 4 — Checkout (5.1–5.9)

`mobile/app/(door)/[eventId]/sell.tsx`

- **Tap to Pay first** in the payment list, above Cash and Eftpos (5.2).
- **Always rendered.** Delete the `tapAvailable` conditional that hides it —
  that is 5.3's explicit prohibition. Never greyed, never altered.
- Pressing it when `needs-terms`:
  - admin → straight into the T&C acceptance flow (5.3)
  - anyone else → the 3.8.1 message
- Copy: **"Tap to Pay on iPhone"** on the method chip, and the pay button reads
  *"Charge $X with Tap to Pay on iPhone"* (5.4, 1.9). Not "Tap".
- Icon: `wave.3.right.circle.fill` via `expo-symbols` `SymbolView` (5.5).
- Move the payment method row and total into a **pinned footer** so the button
  needs no scrolling regardless of how many tiers an event has (5.2).

`mobile/src/components/door/tap-to-pay.tsx`

- Take state from the Phase 1 context instead of running its own discovery — by
  the time it opens the reader is warm (5.6).
- `configuring` → real "Setting up Tap to Pay — X%" screen (5.7).
- Split the terminal outcomes (5.9): **Approved** / **Declined** (with the
  issuer's reason and "try another card or take cash") / **Timed out** (with
  "try the tap again"). Today all three land in one red box.
- Add the receipt step from Phase 5 to **both** the approved and declined
  branches.

---

## Phase 5 — Digital receipts (5.10)

The requirement is receipts "regardless of whether a transaction is approved or
declined", and a declined tap leaves no paid order — `abandonSale` cancels it.
So receipts cannot hang off `TicketOrder`.

**Schema** — `prisma/schema.prisma`, new model:

```prisma
model DoorPaymentReceipt {
  id              String        @id @default(cuid())
  token           String        @unique   // unguessable; the only key the web page takes
  eventId         String
  orderId         String?                 // null on decline
  paymentIntentId String?
  outcome         ReceiptOutcome          // APPROVED | DECLINED | TIMED_OUT
  amountCents     Int
  currency        String        @default("nzd")
  cardBrand       String?
  last4           String?
  declineCode     String?
  createdByUserId String
  sentToEmail     String?
  sentAt          DateTime?
  createdAt       DateTime      @default(now())
}
```

Card brand and last4 come from the confirmed intent's `card_present` details
server-side — never from the client.

**Server**

- `door.recordReceipt` — called by the sheet on every terminal outcome, mints
  the token, re-reads the intent from Stripe. Same posture as `completeSale`:
  the client asks the server to look, it does not assert.
- `door.sendReceipt({ receiptId, email })` — new
  `renderDoorReceiptEmail` template alongside the existing ticketing ones in
  `src/server/ticketing/email/templates.ts`.
- `src/app/(main)/receipts/[token]/page.tsx` — the hosted receipt, which is both
  the email's link and the share sheet's payload. Token-scoped, no session,
  nothing else about the order exposed. That is what "confidential" means here.

**App** — result screen gains an email field and a **Share** button
(`react-native` `Share.share` with the receipt URL). Skippable: at a door most
people walk off, and an unskippable receipt step would jam the queue.

---

## Phase 6 — Splash, push, launch email (3.1, 3.2, 3.3, 6.1, 6.2, 6.3)

**Schema:**

```prisma
model TapToPayAnnouncement {
  id           String    @id @default(cuid())
  userId       String    @unique
  splashSeenAt DateTime?
  pushSentAt   DateTime?
  emailSentAt  DateTime?
}
```

That is what makes "at least once" enforceable rather than aspirational.

- **Splash (3.2, 6.2)** — full-screen modal on launch for eligible staff who
  have not seen it, using the 'Hero' in-app banner from Apple's Marketing Guide.
  Placeholder artwork at `mobile/assets/tap-to-pay-hero.png`, marked as such,
  with the structurally correct copy in place.
- **Push (3.3, 6.3)** — 'Value Proposition' copy, sent through the existing
  `src/server/push.ts` to `DeviceToken` rows belonging to eligible staff. New
  admin mutation `tapToPay.sendLaunchCampaign`, idempotent through
  `pushSentAt`.
- **Email (6.1)** — the 'Launch' email, through the existing ticketing email
  infrastructure, same idempotency through `emailSentAt`.

**Before submission you must replace the placeholder copy and artwork with the
approved versions** from the Tap to Pay on iPhone Marketing Guide and Toolkit
(Stripe partner portal, or Apple's VIP link in the checklist). Apple checks 1.9
against these.

---

## Phase 7 — Face ID / Touch ID (1.7)

Recommended, and cheap given `expo-secure-store` already holds the session.

- After a successful sign-in, offer "Unlock with Face ID next time".
- When enabled, `expo-local-authentication` gates app resume before door mode
  or tickets are shown.
- Toggle in *More* → Account, and a graceful path when biometrics are
  unenrolled or fail — falling back to the existing sign-in, never locking
  somebody out at a door.

---

## Phase 8 — Documentation and the checklist itself

- Update `docs/ticketing/TAP-TO-PAY.md`: the education module, the warm-up
  lifecycle, and `tosAcceptancePermitted` as the mechanism behind 3.8.
- New `docs/ticketing/APP-REVIEW-ANSWERS.md`: the filled checklist cell by cell,
  the single-merchant explanation for section 2 in the form Apple wants it, and
  shot lists for the three required recordings (New User, Existing User,
  Checkout).
- Header fields: Team ID `QB4T85D6S2`, bundle `nz.co.atmosmedia.app`, PSP
  **Stripe**, distribution **Public**, existing app.
- "Other Information" answers: schemes — Visa, Mastercard, American Express;
  refunds — **not supported in-app** today (refunds run from the Stripe
  dashboard), state that plainly rather than implying otherwise; receipt methods
  — email and share sheet; PIN fallback — cash and eftpos at the door.

---

## Sequencing and risk

Phases 1 and 2 unblock everything else and are the two with real technical risk:
Phase 1 because the lifecycle has to be correct across launch, foreground,
disconnect and reconnect; Phase 2 because it is new Swift in a prebuild-managed
project. Phases 3–7 are largely UI on top and can be parallelised once 1 lands.

**External dependencies, none of which code can resolve:**

1. Apple's **distribution** entitlement. Development-only as of 2026-08-13. This
   submission is the route to it. Everything here is testable today on a
   development build.
2. Marketing Guide and Toolkit assets for Phase 6.
3. Confirmation from Stripe of the current **minimum iOS version** for NZ Tap to
   Pay, to pin `MIN_TAP_TO_PAY_IOS`. 17.6 is the checklist's own boundary and a
   safe starting value; Apple's Business Register is the authority and it moves.

**One thing to decide before recording.** The checklist's New User Flow expects
Terms and Conditions to be accepted on camera. Re-accepting means unlinking the
merchant ID from the Apple Account first — Apple documents how, and both links
are in the checklist. Worth doing once on a spare handset rather than discovering
it on the day.
