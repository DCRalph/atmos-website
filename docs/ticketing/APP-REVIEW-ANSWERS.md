# Tap to Pay on iPhone — App Review Requirements Checklist, answered

Against **App Review Requirements Checklist v1.6** (March 2026). Transcribe
these into the spreadsheet at `docs/App Review Requirements Checklist 1_6.xhtml`
and attach it to the email to Apple.

Anything marked ⚠️ still needs a human before submission.

## Header

| Field | Answer |
| --- | --- |
| Team ID | `QB4T85D6S2` |
| App Name | Atmos |
| PSP Name | Stripe |
| Date | ⚠️ date of submission |
| Version | 1.0.0 (⚠️ confirm against `mobile/app.config.ts` at build time) |
| Existing or New app | Existing |
| Distribution type | **Public** (App Store) |
| Number of Devices | ⚠️ count of Atmos door handsets — typically 2–4 |

---

## The single-merchant explanation

Give Apple this before the row-by-row answers. It is what makes section 2
answerable, and it is true.

> Atmos Media is a single merchant. We run our own live-music events in
> Wellington, New Zealand, on one Stripe account belonging to one legal entity.
>
> The Atmos app is a consumer ticketing app on the public App Store: the public
> buy tickets and hold them in the app. Tap to Pay on iPhone is an internal
> box-office tool used by our own staff working the door at our own events. It
> is gated behind a door-staff role that is granted per event by an Atmos
> organiser, and every call is re-checked server-side.
>
> No third party can become a merchant through the app, and no code path exists
> that would let them. Merchant onboarding happened once, out of band, when the
> Stripe account was opened. There is therefore no in-app merchant onboarding
> flow and there will not be one.
>
> A new user who downloads the app can still discover how Tap to Pay is reached:
> **More › Tap to Pay on iPhone** is visible to every signed-in user and
> explains that it is Atmos door tooling, that access is granted per event by an
> organiser, and how to get in touch.

---

## 1. General Requirements

| # | Status | Answer |
| --- | --- | --- |
| 1.1 | ✅ | Supported and enforced at runtime. `supportsReadersOfType` is called before discovery, and an unsupported handset gets its own message naming iPhone XS as the requirement rather than a generic failure. `mobile/src/lib/tap-to-pay.tsx`. |
| 1.2 | **N/A** | Tap to Pay is not the app's primary payment method. The primary method is Stripe checkout on the web for ticket sales; at the door, cash and eftpos are also offered. The deployment target is therefore left at the Expo SDK default so the ticketing app still runs on older iPhones. |
| 1.3 | **N/A** | Same condition as 1.2. `UIRequiredDeviceCapabilities` deliberately does **not** require A12 — that would lock a punter with an older iPhone out of their own ticket over a staff-only feature. The floor is enforced at runtime instead. `supportsTablet` is false. Reasoning is recorded in `mobile/app.config.ts`. |
| 1.4 | ✅ | The iOS version is checked **before** any SDK call, against `MIN_TAP_TO_PAY_IOS` (17.6). Below it the app says: "This iPhone is on iOS *x*. Tap to Pay needs iOS 17.6 or later — update it in Settings › General › Software Update." Checked first precisely so an old OS never surfaces as a generic reader failure. |
| 1.5 | ✅ | The Terminal provider is mounted at the app root, not around door mode. On launch and on every `AppState` transition to active, the app initializes, checks support, discovers and connects. `mobile/src/components/providers.tsx` → `mobile/src/lib/tap-to-pay.tsx`. |
| 1.6 | ✅ | Never stored. Acceptance is re-derived on every launch by attempting a connect with `tosAcceptancePermitted: false` — Apple is the source of truth and is asked again each time. No boolean is persisted anywhere, on device or server. |
| 1.7 | ✅ | Face ID / Touch ID unlock, opt-in from More › Account, with device-passcode fallback. `mobile/src/lib/biometrics.tsx`. |
| 1.8 | ✅ | Custom UI follows the HIG. Apple's payment sheet is themed to match via `setTapToPayUxConfiguration`. |
| 1.9 | ✅ | "Tap to Pay on iPhone" is written in full everywhere it appears — payment option, checkout button, settings row, education, splash, email. ⚠️ Marketing copy for the splash/push/email is placeholder pending the approved assets (see 6.x). |

## 2. Onboarding Merchants

| # | Status | Answer |
| --- | --- | --- |
| 2.1 | ✅ | **More › Tap to Pay on iPhone**, visible to every signed-in user. For somebody who is not door staff it explains that Tap to Pay is Atmos box-office tooling, that access is granted per event by an organiser, and offers a contact link. |
| 2.2 | **N/A** | Single-merchant closed-loop app. There is no third-party merchant onboarding, digital or otherwise — see the explanation above. |
| 2.3 | **N/A** | Same. For reference, a newly-rostered staff member goes from being granted door access to taking a tap in well under 15 minutes, and the New User Flow recording shows exactly that. |

## 3. Enabling Tap to Pay on iPhone

| # | Status | Answer |
| --- | --- | --- |
| 3.1 | ✅ | A dedicated Tap to Pay on iPhone screen, reachable from More and from door mode, plus the one-time launch splash. |
| 3.2 | ✅ | Full-screen modal splash shown once per eligible user. `mobile/src/components/tap-to-pay-splash.tsx`. ⚠️ Hero artwork and copy are placeholder. |
| 3.3 | ✅ | Push notification to all eligible staff, sent once each and recorded per user. Admin trigger at **Admin › Settings › Tap to Pay launch campaign**. ⚠️ Copy is placeholder. |
| 3.4 | **N/A** | No merchant onboarding to end. Its function is served instead by the launch splash and the enable flow, which fire the first time a user is granted door access. |
| 3.5 | ✅ | **Set up Tap to Pay on iPhone** on the hub screen. This is the only path in the app that connects with `tosAcceptancePermitted: true`, and therefore the only one that can raise Apple's acceptance sheet. |
| 3.6 | ✅ | That action lives in settings, entirely outside checkout — More › Tap to Pay on iPhone. |
| 3.7 | ✅ | Both, in effect. Tap to Pay is the first payment option at checkout and is always present; choosing it when the handset is not set up opens the acceptance flow rather than failing. |
| 3.8 | ✅ | **Admin only.** The server answers `canAcceptTerms` from `ctx.isAdmin` and the app cannot decide it for itself — that answer is what gates `tosAcceptancePermitted`. Event organisers and per-event door managers are deliberately excluded: accepting binds the Atmos merchant identity to that person's personal Apple Account. |
| 3.8.1 | ✅ | Everybody else sees: "An Atmos admin needs to accept the Tap to Pay on iPhone Terms and Conditions on this handset before it can take card. Ask one to sign in here, or take cash and eftpos in the meantime." |
| 3.8.2 | **N/A** | Public App Store distribution, not Custom, Unlisted or Enterprise. Apple Business Connect acceptance is not required. |
| 3.9 | ✅ | After education, a dedicated screen invites a real $1 test payment. The dollar is authorised and immediately voided, so staff can prove a handset works on their own card without being out of pocket. `app/(door)/tap-to-pay/try-it.tsx`. |
| 3.9.1 | ✅ | A determinate progress bar fed from `onDidReportReaderSoftwareUpdateProgress` (the SDK's surface for `PaymentCardReader.Event.updateProgress`), shown both during first setup and whenever the reader is preparing during ordinary use. |

## 4. Educating Merchants

| # | Status | Answer |
| --- | --- | --- |
| 4.1 | ✅ | `ProximityReaderDiscovery` via a purpose-built native module — `content(for: .payment(.howToTap))` then `presentContent(_:from:)`, guarded on iOS 18 and presented from the topmost view controller. Not exposed by the Stripe React Native SDK, so written directly against Apple's framework. `mobile/modules/proximity-education`. |
| 4.2 | ✅ | Education is pushed automatically off the SDK's own terms-acceptance callback, so it follows acceptance however acceptance was reached. |
| 4.3 | ✅ | Permanently at More › Tap to Pay on iPhone › How to take a payment. |
| 4.4 | ✅ | Covered by 4.1 per the checklist's own note. |
| 4.5 | ✅ | Covered by 4.1, and by our own screen for iOS 17 — holding a contactless card to the top edge, and which schemes work. |
| 4.6 | ✅ | Covered by 4.1, and by our own screen — Apple Pay, Google Pay, Samsung Pay, and that watches need to be held closer than a card. |
| 4.7 | ✅ | **Applies: New Zealand supports PIN entry** (iOS 16.4+). Education says to hand the phone to the customer, never to enter or watch the PIN, and names the accessibility options on Apple's PIN screen — VoiceOver with a spoken randomised keypad, and the shuffled layout. |
| 4.8 | ✅ | Fallback is covered: ask for another card or a wallet, and failing that take cash or eftpos and record the sale, which the Sell screen already supports. |

## 5. Checking Out

| # | Status | Answer |
| --- | --- | --- |
| 5.1 | ✅ | A full-width payment option and a full-width action button. |
| 5.2 | ✅ | **First** in the payment list, above Cash and Eftpos, and the whole payment block is pinned to the bottom of the screen so no number of ticket tiers can push it below the fold. |
| 5.3 | ✅ | Always rendered, never greyed, never hidden — including when the reader is unavailable. Choosing it when the handset is not set up opens the Terms and Conditions (for an admin) or the explanation of who can (for anybody else). |
| 5.4 | ✅ | "Tap to Pay on iPhone" on the option; "Charge $X with Tap to Pay on iPhone" on the button. |
| 5.5 | ✅ | `wave.3.right.circle.fill`, the real SF Symbol via `expo-symbols` — not a redraw. |
| 5.6 | ✅ | The reader is warmed up and connected at app launch, so the sheet opens onto a live connection and starts collecting immediately without a second button press. |
| 5.7 | ✅ | If the reader is still configuring, the sheet shows the progress bar and tells the merchant it will be available in a moment. |
| 5.8 | ✅ | A distinct "Processing" screen once the card has been read, then "Issuing tickets". |
| 5.9 | ✅ | Three separate endings: **Approved**, **Declined** ("ask for another card or take cash"), **No card read** ("try again, hold to the top until it buzzes"). |
| 5.10 | ✅ | Every terminal outcome writes a `DoorPaymentReceipt`, including declines and timeouts, which leave no order behind. The customer can be emailed a receipt or handed a token-scoped link through the iOS share sheet. The page shows only the payment — no order contents, no QR codes. |
| 5.11 | ✅ | New Zealand. PIN entry supported and covered in education; contactless limits are Stripe's regional defaults; fallback is cash or eftpos. |

## 6. Marketing

| # | Status | Answer |
| --- | --- | --- |
| 6.1 | ⚠️ | Launch email built and sendable, idempotent per user. Admin › Settings › Tap to Pay launch campaign. **Replace the placeholder body with the Marketing Guide's 'Launch' email copy before sending.** |
| 6.2 | ⚠️ | In-app splash built and shown once per eligible user. **Drop the 'Hero' in-app banner into `mobile/assets/tap-to-pay-hero.png` and swap the placeholder copy.** |
| 6.3 | ⚠️ | Push built and sendable, idempotent per user. **Replace the placeholder body with the 'Value Proposition' push copy.** |

### The four assets, and exactly where each goes

Assets come from the Tap to Pay on iPhone Marketing Guide and Toolkit —
Stripe's partner portal (`portal.stripe.partners`, requires Stripe Partner
status) or the VIP link in the checklist itself.

| Asset | Kind | Destination |
| --- | --- | --- |
| **'Hero' in-app banner** | image | `mobile/assets/tap-to-pay-hero.png` — then replace the `<View style={styles.hero}>` block in `mobile/src/components/tap-to-pay-splash.tsx` with the `<Image>` written out in the comment above it. Ship @2x/@3x; the container is 200pt tall. |
| **Splash copy** | text | `mobile/src/components/tap-to-pay-splash.tsx` — headline, body, three bullets |
| **'Value Proposition' push copy** | text | `src/server/ticketing/tap-to-pay-launch.ts` — `PUSH_TITLE`, `PUSH_BODY` |
| **'Launch' email copy** | text | `src/server/ticketing/email/templates.ts` → `renderTapToPayLaunchEmail` — subject, headline, body paragraph. The "Getting started" steps below are Atmos operational instructions, not marketing copy, and can stay. |

Nothing else is needed. Merchant education artwork (4.4) is Apple's own,
supplied by `ProximityReaderDiscovery`, and the contactless mark (5.5) is a
system SF Symbol rather than a bundled asset.

**Swap the copy before running the launch campaign.** The campaign is
idempotent per person, so whatever goes out is the one send each staff member
gets — a placeholder push cannot be re-sent over without editing
`TapToPayAnnouncement` by hand.

## Other Information

| Question | Answer |
| --- | --- |
| Supported schemes | Visa, Mastercard, American Express. (⚠️ confirm against the Atmos Stripe account's enabled card networks.) |
| Is Refund supported | **Not in the app.** Refunds are issued from the Stripe dashboard and the Atmos admin web console, not from the handset. Door staff have no refund capability. |
| Receipt methods | Email, and a token-scoped web receipt shared through the iOS share sheet (AirDrop, Messages, Mail). Both available for approved and declined transactions. |
| PIN fallback — alternative payment methods | Cash, and an external eftpos terminal. Both are first-class options on the same checkout screen and are recorded against the same order. |

---

## Recording scripts

Three recordings, all required. Record with a second device where the checklist
asks for it.

### New User Flow — the new staff member

There is no merchant onboarding, so this is the path a new Atmos door staffer
actually takes. Say so at the start of the recording.

1. An organiser adds the user to an event's door staff. (Show the admin console,
   or state it.)
2. The user opens the Atmos app. **The launch splash appears** — full screen,
   Tap to Pay on iPhone. *(3.2, 6.2)*
3. Tap **Set it up**, landing on More › Tap to Pay on iPhone. *(3.1, 3.6)*
4. **Signed in as a non-admin first**: show the "An Atmos admin needs to accept…"
   message. *(3.8, 3.8.1)*
5. Sign in as an admin. Tap **Set up Tap to Pay on iPhone** → Apple's Terms and
   Conditions sheet → accept. *(3.5)*
6. Education appears automatically: Apple's `ProximityReaderDiscovery` overlay on
   iOS 18. *(4.1, 4.2)*
7. Dismiss it; show the in-app education screens behind — cards, wallets, PIN and
   its accessibility options, fallback. *(4.5–4.8)*
8. **Configuration progress bar** while the reader prepares, then completion.
   *(3.9.1)*
9. The "Try Tap to Pay on iPhone" screen; take the $1 test payment. *(3.9)*
10. Go back to More › Tap to Pay on iPhone › How to take a payment to show
    education is permanently reachable. *(4.3)*

### Existing User Flow

1. **Before accepting**, open a door and the Sell screen: show that the Tap to
   Pay on iPhone option is present, first in the list, and not greyed. *(5.2, 5.3)*
2. Show the splash and/or the push notification as how an existing user learns
   it is available. *(3.1, 3.3)*
3. Press the Tap to Pay button while unaccepted — it opens acceptance. *(5.3)*
4. Accept, then show education following. *(4.2)*
5. Show where education lives afterwards. *(4.3)*
6. If configuration is still running, show the progress indicator. *(3.9.1)*

### Checkout Flow

1. Open a door, Sell screen, add tickets with the steppers. *(5.1)*
2. Show all three payment options, Tap to Pay on iPhone at the top. *(5.2)*
3. Show the button and its `wave.3.right.circle.fill` symbol. *(5.4, 5.5)*
4. Press it — Apple's sheet should appear within a second. *(5.6)*
5. Complete a real tap. Show Processing, then Approved. *(5.8, 5.9)*
6. Send a receipt: email, and the share sheet. *(5.10)*
7. **PIN**: run a transaction over the NZ contactless limit, or use a physical
   test card with an amount ending `.03`, and show Apple's PIN screen. *(4.7, 5.11)*
8. **Decline**: tap a card that will be refused. Show the Declined screen, then
   send a receipt for the decline. *(5.9, 5.10)*
9. Show taking cash instead as the fallback. *(4.8)*

**Before recording**, unlink the Apple Account from the merchant ID so terms can
be accepted on camera. Apple documents how, and the link is in the checklist.
Rehearse on a spare handset — this is not something to discover on the day.

---

## Before this can be submitted

1. **Apple's distribution entitlement.** Still development-only as of
   2026-08-13. This submission is the route to it; `scripts/build-ipa.sh` sets
   `TAP_TO_PAY=0` until it is granted, and that line comes out once it is.
2. **Marketing assets** for 6.1, 6.2 and 6.3.
3. **Confirm `MIN_TAP_TO_PAY_IOS`** with Stripe. 17.6 is the checklist's own
   boundary and a safe starting value; Apple's Business Register is the
   authority and it moves as versions age out.
4. **Confirm the card networks** enabled on the Atmos Stripe account, for the
   "Supported schemes" answer.
