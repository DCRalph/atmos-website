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
| Age rating | **18+**, via Override to Higher Age Rating (see below) |

### Age rating — 18+

Every Atmos event is R18 (`TicketEvent.isR18` defaults to true), the venues are
licensed, and the app is the way in to them. Rating it for the audience it
actually serves is the honest answer.

The questionnaire on its own lands lower than 18+, and that is fine: answer it
**accurately**, then raise the result with **Age Categories and Override ›
Override to Higher Age Rating › 18+**. Apple lets you raise the calculated
rating but never lower it, and the content descriptions keep reflecting the
real answers.

Do not reach 18+ by inflating an answer. Apple treats an inaccurate
questionnaire as misrepresentation whichever way it errs, and 1.0 was rejected
under Guideline 2.3.6 for exactly that: Age Assurance was answered Yes, and the
app has no age assurance.

| Section | Question | Answer | Why it is true |
| --- | --- | --- | --- |
| In-App Controls | Parental Controls | **None** | There are no parental controls. |
| In-App Controls | Age Assurance | **None** | The app never checks its user's age. Apple means the Declared Age Range API, age estimation, or verifying the user's ID. Door staff checking a patron's ID at the venue is not that. |
| Capabilities | Unrestricted Web Access | **No** | More opens fixed atmosmedia.co.nz pages in a Safari sheet with no address bar. |
| Capabilities | User-Generated Content, Social Media, Advertising | **No** | None of it exists. |
| Capabilities | Messaging and Chat | **No** | Customers cannot message anybody. Gig rooms are an internal tool for Atmos organisers and never render for a customer. |
| Mature themes | Alcohol, Tobacco, or Drug Use or References | **Infrequent** | Events are held in licensed venues and the app sells entry to them. |
| Everything else | Violence, sexual content, profanity, horror, gambling, contests, medical | **None** | The app contains none of it. |

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
| Demo account | `review-customer@atmosmedia.co.nz` — see below |
| Attachment | The review walkthrough video (see below) |

### Demo accounts

1.0 was rejected under Guideline 2.1(a) without them: the reviewer made their
own account with Sign in with Apple and landed on an empty Tickets tab.

Both accounts, and everything they show, come from one script:

```
APP_REVIEW_PASSWORD=... bun run db:seed-app-review
```

**Run it before every submission.** It resets whatever the last reviewer did
(check-ins, door sales, ID checks), moves the demo night about six months
ahead so it is never in the past, and resets both passwords to the value
given. It sends no email. The password is not kept in the repo: use the same
one each time and keep it with the App Store Connect login.

| Account | Email | What it shows |
| --- | --- | --- |
| Customer | `review-customer@atmosmedia.co.nz` | Two tickets to **Atmos Demo Night**, with QR codes and Add to Apple Wallet |
| Door staff | `review-door@atmosmedia.co.nz` | Manager on Atmos Demo Night only: door mode with a 12-name guest list, the run sheet, Tap to Pay guides |

The demo night is invisible to the public: its gig is a draft and its ticket
event is unlisted. Atmos admins and organisers will see it in their own door
and run sheet lists, named so nobody mistakes it for a real show. Every ticket
is a comp, so it adds nothing to takings.

Put the customer account in the **Sign-in information** fields, and both
accounts in the notes:

```
Atmos is the ticketing app for our own live music events in Wellington, New
Zealand. Atmos Media is a single merchant on one Stripe account.

Sign in with Apple, Google and email/password are all offered. Use
email/password with the accounts below (More > Sign in, or Tickets > Sign in).

CUSTOMER ACCOUNT
  email:    review-customer@atmosmedia.co.nz
  password: <password>
Tickets tab > Atmos Demo Night shows two tickets with their QR codes, and each
can be added to Apple Wallet. More > Settings > Notifications controls push.
More > Account > Delete account deletes the account, confirmed by an emailed
link.

DOOR STAFF ACCOUNT
  email:    review-door@atmosmedia.co.nz
  password: <password>
Sign out of the customer account first (More > Sign out). This account is door
staff on the demo event. More > Internal > Door mode > Atmos Demo Night opens
the door tools:
  - List: search the guest list, tap a name to check them in
  - Manual: type a ticket number to admit it, e.g. one shown on the customer
    account's ticket
  - Sell: sell or comp a ticket at the door (cash and eftpos are recorded only;
    no card is charged)
  - ID: record an ID check by typing the details
  - Log: everything scanned tonight
More > Internal > Run sheet shows the night's running order. More > Internal >
Tap to Pay guides explains Tap to Pay on iPhone.

These door screens never render for a customer account, and the server refuses
the calls behind them, so they can only be reviewed with the door account. The
demo event and its guest list are fictional and reset before each submission.
Event analytics, gig rooms and team notifications are internal tools for Atmos
Media's own organisers. They show real events, takings and customer details,
so they are not on the review account.

Ticket purchases: when a gig is sold through Atmos, its page shows a Tickets
button that opens checkout (Stripe payment sheet, or a free claim for RSVP
tiers). Current gigs sell through external sellers, so their Tickets button
opens that seller's page instead. The attached video shows the in-app
checkout.

Tap to Pay on iPhone is internal box-office tooling used by our own staff at
our own events. It is not offered to customers. Apple has granted the
entitlement for development only, so this build ships without it and the Sell
screen reports Tap to Pay as unavailable. See our completed App Review
Requirements Checklist v1.6, emailed separately.

The app is built for iPhone. The camera is only used by door staff to scan
tickets; every door action can also be done by typing.
```

⚠️ The checkout paragraph only holds while no upcoming gig sells through
Atmos ticketing. Once one does, replace it with the gig's name so the reviewer
can open its checkout directly.

### Review video

`appstore/review-video/atmos-app-review.mp4`, attached under App Review
Information. Apple is explicit that a video does not replace demo accounts, so
it is there to show what a single review device cannot: the in-app checkout,
and the door flow end to end. Regenerate it with
`appstore/review-video/record.sh` (see its header).

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
| 2 | `04-gig-bright.png` | A date doing its job: bright poster, line-up, genre, rich description with linked artists, photo gallery |
| 3 | `05-gig-dark.png` | The same screen with a dark cinematic poster — deliberately unlike 2 |
| 4 | `02-gigs.png` | Gigs — upcoming above, been-and-gone below |

Four gig posters would read as four pictures of one gig, so the two detail
screens are picked to disagree: a bright photographic poster against a dark one.
Neither currently shows the **Tickets** CTA — both dates have since passed, and
the only upcoming date sells through an external link and shares Home's poster.
Recapture `04`/`05` (`ATMOS_SHOT_GIG_BRIGHT=<id>`) when the next Atmos-ticketed
gig is announced so the from-price button is in shot.

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

### Done for the 1.0 resubmission

- [x] **Guideline 2.3.6** — the age rating answers above. Age Assurance was
      answered Yes for 1.0; the app has none.
- [x] **Guideline 2.1(a)** — demo accounts with pre-populated tickets, from
      `bun run db:seed-app-review` (section 7).
- [x] **Customers were shown the Tap to Pay splash.** `tapToPay.announcement`
      and the `terminal.*` calls used `doorProcedure`, which refuses nobody, so
      every signed-in customer was offered Tap to Pay setup and the Stripe
      Terminal SDK started up on their phone. Apple's own reviewer hit it in
      1.0. They now use `doorStaffProcedure`. Server-side, so it needs a
      deploy, not a build.
- [x] **Add to Apple Wallet opened a blank sheet on iPad**, which has no
      Wallet and is where App Review tests an iPhone-only app. The button is
      now hidden where PassKit says passes cannot be added
      (`modules/apple-wallet`). Native, so it needs a new build — as do the
      two app fixes below.
- [x] **Switching accounts kept the last account's answers.** Nothing reset
      the query cache on sign-out, so a door account signed in after a
      customer saw no Internal section for five minutes — exactly the order a
      reviewer goes in — and could briefly see the customer's tickets. The
      cache now resets whenever the signed-in account changes.
- [x] **"Test lock screen" is organiser-only.** iPad has no Live Activities,
      so on the review device it did nothing visible, and a button called
      "Test" invites a Guideline 2.2 question.
- [x] **Builds from Xcode 27 died on launch on iOS 27.** iOS 27 requires the
      UIScene life cycle of anything built with its SDK, and SDK 57's prebuild
      template does not adopt it. `plugins/with-scene-lifecycle.js` does,
      with `expo` 57.0.26's scene delegate. Simulators on the build Mac only
      run iOS 26, which does not enforce this, so check every build on a
      phone running iOS 27 before uploading it.
- [x] The website routes the app depends on (associated domains, Sign in with
      Apple, password reset, account deletion) are live.

### Every submission

- [ ] **Deploy the website first.** Server fixes reach the build under review
      only once they are live.
- [ ] `APP_REVIEW_PASSWORD=... bun run db:seed-app-review`, then sign in to
      both accounts once to check.
- [ ] Build with `scripts/build-ipa.sh` — it verifies version, build number,
      icon, that the Tap to Pay entitlement is absent, and that the Sign in with
      Apple and associated-domains entitlements are present.
- [ ] Upload the `.ipa` with Transporter.
- [ ] Age rating answers, demo account and notes as in sections 1 and 7, with
      the review video attached.
- [ ] Email Apple the completed App Review Requirements Checklist v1.6 —
      `docs/ticketing/APP-REVIEW-ANSWERS.md`.
- [ ] ⚠️ The Tickets screenshot is still missing — see section 9.
