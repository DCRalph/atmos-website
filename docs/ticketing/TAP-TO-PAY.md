# Tap to Pay on iPhone

Taking contactless card payments at the door on the phone itself, with no
separate reader. Stripe Terminal's `tapToPay` discovery method drives it from
`mobile/src/components/door/tap-to-pay.tsx`.

It needs one thing that cannot be done in code: **Apple has to grant the app an
entitlement.** Until they do, the sheet hangs on "Getting the reader ready"
forever, because reader discovery never returns anything to connect to.

## Checking whether the entitlement is present

Against a built `.app`:

```bash
codesign -d --entitlements - --xml \
  ~/Library/Developer/Xcode/DerivedData/Atmos-*/Build/Products/Release-iphoneos/Atmos.app \
  | plutil -convert xml1 -o - - | grep -A1 proximity-reader
```

Present means a `com.apple.developer.proximity-reader.payment.acceptance` key.
As of writing the build signs with only these, and Tap to Pay does not work:

```
application-identifier
aps-environment
com.apple.developer.associated-domains
com.apple.developer.team-identifier
get-task-allow
```

## Getting it

Three separate approvals, none of which imply the others. Start the first
immediately — it is the long pole, measured in days to weeks.

1. **Apple grants the entitlement.** Request it at
   <https://developer.apple.com/contact/request/tap-to-pay-on-iphone/> against
   team `QB4T85D6S2` and bundle id `nz.co.atmosmedia.app`. This is a manual
   review by Apple, not a switch in the developer portal.
2. **Stripe enables Tap to Pay on the account.** Gated separately from Apple's
   side, through the Stripe dashboard or support. An account can hold a valid
   Terminal location and still not be cleared for Tap to Pay.
3. **Enable the capability on the App ID** once Apple has granted it, then
   regenerate the provisioning profile so the entitlement is actually signed in.

### Then, in this repo

Add the entitlement to `mobile/app.config.ts`:

```ts
ios: {
  entitlements: {
    "com.apple.developer.proximity-reader.payment.acceptance": true,
  },
},
```

Rebuild for the device and reinstall. Verify with the `codesign` command above
before testing at a door — a build without it fails identically to no build at
all, and the failure looks like a network problem rather than a signing one.

## What the Stripe Expo plugin does and does not do

`@stripe/stripe-terminal-react-native`'s config plugin **does not add the iOS
entitlement**. Reading `plugin/withStripeTerminal.js`:

- `withStripeTerminalIos` writes Info.plist usage strings only —
  `NSLocationWhenInUseUsageDescription`, the Bluetooth ones, local network, and
  optionally the `bluetooth-central` background mode.
- `withTapToPayAndroid`, which the `tapToPayCheck` option controls, is
  **Android-only**. It injects a `TapToPay.isInTapToPayProcess()` guard into
  `MainApplication.kt`. It has no iOS effect whatsoever.

This matters because `app.config.ts` sets `tapToPayCheck: true` under a comment
about Tap to Pay, which reads as though the plugin is handling the iOS side. It
is not. The entitlement is entirely manual.

## The rest of the setup, which is already correct

Recorded so nobody re-debugs it while waiting on Apple.

| Piece | Where | State |
| --- | --- | --- |
| Discovery method | `tap-to-pay.tsx` | `discoveryMethod: "tapToPay"` — correct for this SDK |
| Simulated reader | `tap-to-pay.tsx` | `simulated: __DEV__` — false in Release, so real hardware |
| Connection token | `terminal.connectionToken` | Minted server-side against the secret key |
| Terminal location | `STRIPE_TERMINAL_LOCATION_ID` | Set; required by `connectReader` |
| Stripe key | `STRIPE_SECRET_KEY` | Live |

The token provider is wired at the door layout rather than the sell screen
(`mobile/app/(door)/_layout.tsx`), so the reader stays connected between sales
instead of reconnecting per transaction.

## Device requirements

Apple's, not ours: iPhone XS or later, and a current iOS. An older handset fails
the same way — discovery returns nothing — so confirm the phone before assuming
it is the entitlement.

## Failure modes worth telling apart

| Symptom | Cause |
| --- | --- |
| Stuck on "Getting the reader ready" | Entitlement missing, Stripe account not enabled, or unsupported device. Discovery never returns a reader. |
| "This door has no Stripe location set" | `STRIPE_TERMINAL_LOCATION_ID` unset on the server |
| Connects, then fails on tap | Account or payment-method problem, not setup — read the Stripe error |

The first row is the ambiguous one, and all three of its causes look identical
from the app. Check the entitlement with `codesign` first, since it is the only
one answerable without leaving the machine.
