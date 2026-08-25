# Atmos — App Store submission pack

Everything App Store Connect asks for, in the order it asks for it. Copy is
final unless marked ⚠️, which means it needs a human decision or a fact only you
have. The convention matches `docs/ticketing/APP-REVIEW-ANSWERS.md`.

Screenshots are in `screenshots/iphone-6.9/`, captured from a Release build
running against production. Regenerate with `scripts/screenshots.sh`.

---

## 1. App information

| Field | Value |
| --- | --- |
| Name | `Atmos` |
| Bundle ID | `nz.co.atmosmedia.app` |
| SKU | ⚠️ `atmos-ios` unless App Store Connect already has one |
| Primary language | English (New Zealand) |
| Version | `1.0.0` — from `mobile/package.json` |
| Build | Set by `scripts/build-ipa.sh`; minutes since 2025-01-01 UTC |
| Primary category | Entertainment |
| Secondary category | Music |
| Content rights | Contains no third-party content |
| Age rating | **17+** (see below — may be **18+** under Apple's current tiers) |

### Age rating — 17+

Set deliberately, overriding the 4+ that the questionnaire would otherwise
produce. Every Atmos event is R18 (`TicketEvent.isR18` defaults to true), the
venues are licensed, and the app is the way in to them. Rating it for the
audience it actually serves is the honest answer, and it removes any argument
that the listing understates what it sells.

Answer the questionnaire like this. Each of these is **true of this app** — none
is inflated to reach a number, which matters, because Apple treats an inaccurate
questionnaire as a misrepresentation regardless of which direction it errs in.

| Question | Answer | Why it is true |
| --- | --- | --- |
| Alcohol, Tobacco, or Drug Use or References | **Infrequent/Mild** | Events are held in licensed venues and the app sells entry to them |
| Age assurance / age-restricted content | **Yes — 18+** where offered | Every event is R18 and ID is checked at the door |
| Everything else (violence, sexual content, gambling, horror, contests) | **None** | Accurate — the app contains none of it |

⚠️ **The tier may not be called 17+ any more.** Apple replaced the old 4+/9+/12+/17+
ladder with **4+/9+/13+/16+/18+** in its 2025 age-rating update. If App Store
Connect no longer offers 17+, take **18+** — it is the correct equivalent for
R18-only events, not 16+. Confirm against what the questionnaire actually shows
you on the day.

The R18 door policy also stays in the description, because that is where a
customer actually reads it.

---

## 2. Name, subtitle, keywords

**App Name** (30 max) — 5 used

```
Atmos
```

**Subtitle** (30 max) — 29 used

```
Live music tickets, Wellington
```

⚠️ Alternatives if you would rather lead with the wallet than the city:

- `Your tickets, on your phone` (27)
- `Gigs and tickets in your pocket` (31 — one over, needs a trim)

**Keywords** (100 max, comma-separated, no spaces after commas, do not repeat
the app name or the subtitle words — Apple already indexes those)

```
gig,rave,club,dj,electronic,dnb,house,techno,event,venue,door,rsvp,lineup,nz
```

83 characters. Deliberately no "ticket", "music" or "Wellington": all three are
already in the name, subtitle or category and repeating them wastes the field.

---

## 3. Description (4000 max)

```
Atmos runs live electronic music events in Wellington. This is the app for
going to them.

BROWSE WHAT'S ON
Every Atmos date, with the full line-up, set times, venue and door time. Past
shows stay in the app so you can find that night you're trying to remember the
name of.

TICKETS THAT LIVE ON YOUR PHONE
Buy in a few taps and your ticket is in the app immediately. No printing, no
digging through email at the door, no screenshotting a QR code and hoping.

ADD TO APPLE WALLET
Every ticket adds to Apple Wallet, so it's on your lock screen when you arrive
and it works whether or not the venue has signal.

STRAIGHT THROUGH THE DOOR
Door staff scan the code in the app. Entry takes a couple of seconds.

KNOW WHEN A DATE DROPS
Turn on notifications and hear about new shows when they're announced, not when
they've sold out. You can mute them any time.

Events are R18 unless stated otherwise. Bring ID.

Atmos Media, Wellington, Aotearoa New Zealand.
```

⚠️ Read this once against what actually ships. In particular: the description
promises Apple Wallet passes and push on new dates, and both need to be true and
reachable on a fresh install before you submit.

---

## 4. Promotional text (170 max)

Editable without a new build, so use it for whatever is on next.

```
Daffodil Dancefloor, 28 August at San Fran. Line-up, set times and tickets in
the app. New dates land here first.
```

127 characters. ⚠️ Update per release, or it dates badly.

---

## 5. What's New (4000 max)

For 1.0.0, first release:

```
The first Atmos app.

Browse every upcoming date, buy tickets, and keep them on your phone and in
Apple Wallet. Get a notification when a new show is announced.
```

---

## 6. URLs

| Field | Value | Verified |
| --- | --- | --- |
| Support URL | `https://atmosmedia.co.nz/contact` | 200 |
| Marketing URL | `https://atmosmedia.co.nz` | 200 |
| Privacy Policy URL | `https://atmosmedia.co.nz/privacy` | 200 |
| Terms (EULA) | `https://atmosmedia.co.nz/terms` | 200 — standard Apple EULA otherwise |

All four returned 200 at the time of writing.

---

## 7. App Review Information

| Field | Value |
| --- | --- |
| First name | William |
| Last name | Giles |
| Phone | ⚠️ |
| Email | ⚠️ |
| Sign-in required | **Yes** |
| Demo account | ⚠️ see below |

### Demo account — the thing most likely to get this rejected

Two separate problems, and they need two different answers.

**A customer account.** A reviewer must be able to see a ticket. Sign-up is
email-based, so leaving this blank means a reviewer lands on an empty Tickets tab
and cannot evaluate the app's main purpose.

> ⚠️ Create a review account and issue it a comp ticket to a real upcoming
> event, so the Tickets tab and the QR code both render. `src/server/ticketing/comps.ts`.

**A door-staff account.** This is already documented in
`docs/ticketing/APP-REVIEW-ANSWERS.md`, and it matters more than it looks:
Tap to Pay and every door screen render *only* for an account the server
recognises as staff. A reviewer signed in as a customer sees no internal tooling
at all, because for them none exists.

Suggested review notes:

```
Atmos is a consumer ticketing app for our own live-music events in Wellington,
New Zealand. Atmos Media is a single merchant on one Stripe account.

Sign in with Apple, Google and email/password are all offered. An account can
be deleted from inside the app at More > Account > Delete account.

CUSTOMER ACCOUNT (main app):
  email: ⚠️
  password: ⚠️
This account holds a ticket to an upcoming event. Tickets tab shows the ticket
and its QR code, and the ticket can be added to Apple Wallet.

DOOR STAFF ACCOUNT (internal tooling):
  email: ⚠️
  password: ⚠️
Sign in with this account to reach More > Internal, which is where door mode
and Tap to Pay on iPhone live. These screens do not render for a customer
account, and the server refuses the calls behind them, so the customer account
above cannot be used to review them.

Tap to Pay on iPhone is internal box-office tooling used by our own staff at our
own events. It is not offered to customers. Apple has granted the entitlement
for development only, so this build ships without it and the sell sheet reports
Tap to Pay as unavailable. See our completed App Review Requirements Checklist
v1.6, emailed separately.

The app requires iOS 16.4 or later. Tap to Pay additionally requires iPhone XS
or later, enforced at runtime rather than by UIRequiredDeviceCapabilities, so
that a customer with an older iPhone is not locked out of their own ticket.
```

---

## 8. Privacy — App Privacy questionnaire

Answer these in App Store Connect. ⚠️ Verify each against the current schema
before submitting; this is derived from the code, not from a lawyer.

### Data collected and linked to the user

| Type | What | Purpose |
| --- | --- | --- |
| Contact Info — Name | `User.name` | App Functionality |
| Contact Info — Email | `User.email`, better-auth | App Functionality, and Marketing if they opt into the newsletter |
| Purchases — Purchase History | `TicketOrder`, `Ticket` | App Functionality |
| Identifiers — User ID | `User.id`, session | App Functionality |
| Usage Data — Product Interaction | PostHog on the web; ⚠️ confirm whether the app sends any |

### Data not linked to the user

| Type | What | Purpose |
| --- | --- | --- |
| Diagnostics — Crash Data | ⚠️ only if you enable crash reporting |

### Not collected

Location, contacts, photos, health, financial info, browsing history.

Worth stating explicitly because two of these look like they should be collected
and are not:

- **Payment card data never reaches Atmos.** Stripe handles it. The app holds no
  card numbers and stores none.
- **Location is requested but not collected.** The
  `locationWhenInUsePermission` string exists because the Stripe Terminal SDK
  requires it for Tap to Pay. It applies to staff handsets only and the position
  is used by Stripe for payment processing, not stored by Atmos.

### Permission strings shipped

| Key | String |
| --- | --- |
| `NSCameraUsageDescription` | Atmos uses the camera to scan tickets at the door. |
| `NSFaceIDUsageDescription` | Atmos uses Face ID to unlock this handset for door mode and your tickets. |
| `locationWhenInUsePermission` | Stripe uses your location to process payments at the door. |

### Export compliance

`ITSAppUsesNonExemptEncryption` is `false` in `app.config.ts`, so App Store
Connect will not ask. Correct: the app uses HTTPS and platform crypto only.

---

## 9. Screenshots

Apple requires **iPhone 6.9"** only. iPad is not required — `supportsTablet` is
false, and the app is not offered on iPad.

| Size | Pixels | Required | Status |
| --- | --- | --- | --- |
| iPhone 6.9" | 1320 × 2868 | Yes | in `screenshots/iphone-6.9/` |
| iPhone 6.5" | 1284 × 2778 | No | Apple scales the 6.9" set |
| iPad 13" | — | No | app is iPhone-only |

Captured from a Release build against production, with the status bar overridden
to Apple's canonical 9:41, full battery and full signal — so no simulator
artefacts, low battery or "Carrier" text end up in the listing.

**Ready to upload** — `screenshots/iphone-6.9/`. Upload in this order; Apple
gives the first three the most prominence.

| Order | File | Shows |
| --- | --- | --- |
| 1 | `01-home.png` | Home — brand, and the next date's poster filling the screen |
| 2 | `04-gig-bright.png` | A date doing its job: bright poster, venue, time, genre, **Tickets**, line-up |
| 3 | `05-gig-dark.png` | The same screen with a dark cinematic poster — deliberately unlike 2 |
| 4 | `02-gigs.png` | Gigs — upcoming above, been-and-gone below |

Four gig posters would read as four pictures of one gig, so the two detail
screens are picked to disagree: a bright photographic poster against a dark one.
Both show the **Tickets** button, which the earlier Daffodil capture did not
because that date has no tiers on sale.

**Held back** — `screenshots/_not-ready/`, with a reason per file in its README.

⚠️ The Tickets screenshot is still missing, and it is the one Apple will look at
hardest for a ticketing app. It needs a signed-in account holding a real ticket
so the QR code and the Add to Apple Wallet button render. Sign in on the
simulator, give that account a comp, then `ATMOS_SHOTS=07 ./scripts/screenshots.sh`.

⚠️ These are raw device captures, not marketed screenshots with captions and
device frames. Apple accepts raw captures. If you want captioned ones, these are
the correct source images to build them from.

---

## 10. Pre-submission checklist

### Done in the code

- [x] **Sign in with Apple** — Guideline 4.8. `src/server/auth.ts` configures
      the `apple` provider against the bundle identifier, and the sign-in screen
      renders Apple's own button above Google. Native-only, so there is no
      Services ID or `.p8` client secret to manage.
- [x] **Delete account** — Guideline 5.1.1(v). More > Account > Delete account,
      confirmed by an emailed link. Personal details go; orders are detached and
      scrubbed rather than dropped, because they are sales records. See
      `src/server/account-deletion.ts`.
- [x] **`/.well-known/apple-app-site-association`** is served by a route handler
      of that name in the website, claiming `/gigs/*` and `/tickets/*`. The app
      reads the path segment of a ticket link as the order access token, so an
      emailed link now opens the order in the app.
- [x] **Notification settings** — More > Settings > Notifications, per handset,
      which is what the description's "you can mute them any time" promises.
- [x] **Forgotten password** — on the sign-in screen; the link lands on
      `/reset-password` on the website.
- [x] **Free and RSVP tiers** now claim through `ticketCheckout.claimFree`
      instead of presenting a Stripe sheet that was never initialised.
- [x] **Buyer email is collected by the payment sheet**, so a signed-out
      purchase actually gets a confirmation email.
- [x] **A `TO_BE_ANNOUNCED` gig no longer appears under "Been and gone"** dated
      1970. It sits at the end of Upcoming, labelled "Date TBA".

### Still needs a human

- [ ] ⚠️ **Enable the "Sign In with Apple" capability** on App ID
      `nz.co.atmosmedia.app` in the Apple Developer portal, then regenerate the
      provisioning profiles. Without it the archive will not export.
      `scripts/build-ipa.sh` fails the build if the entitlement is missing.
- [ ] ⚠️ **Deploy the website before submitting.** The app's associated-domains
      claim, Sign in with Apple, account deletion and password reset all depend
      on server routes that are in this change and not yet live.
- [ ] ⚠️ Create and test the two review accounts above.
- [ ] ⚠️ Confirm the Apple Wallet pass builds for the review account's ticket.
- [ ] ⚠️ The Tickets screenshot is still missing — see section 9.
- [ ] Build with `scripts/build-ipa.sh` — it verifies version, build number,
      icon, that the Tap to Pay entitlement is absent, and that the Sign in with
      Apple and associated-domains entitlements are present.
- [ ] Upload the `.ipa` with Transporter.
- [ ] Email Apple the completed App Review Requirements Checklist v1.6 —
      `docs/ticketing/APP-REVIEW-ANSWERS.md`.
