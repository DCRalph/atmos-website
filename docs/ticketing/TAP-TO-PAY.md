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

## Development and distribution are granted separately

The entitlement can be live for development builds and still absent from App
Store ones. That is not a caching problem and no amount of re-provisioning
fixes it — Apple simply issues the two profile types differently.

**Confirmed for this app on 2026-08-13:** the grant is development-only. Tap to
Pay works on builds installed directly to a registered device, and the App Store
export fails until Apple extends the grant to distribution. Everything below is
the evidence trail; skip to "Building for a device" if you just want it running
on a phone.

Observed on 2026-08-13, with both profiles issued four minutes apart by
automatic signing:

```
iOS Team Provisioning Profile: nz.co.atmosmedia.app          tapToPay = 1
iOS Team Store Provisioning Profile: nz.co.atmosmedia.app    tapToPay = 0
```

The export then fails with:

```
Provisioning profile "iOS Team Store Provisioning Profile: nz.co.atmosmedia.app"
doesn't include the Tap to Pay on iPhone capability.
```

Note the wording — Apple names the capability, which means the App ID has it.
Compare with the message when the entitlement is not granted at all:

```
Entitlement com.apple.developer.proximity-reader.payment.acceptance not found
and could not be included in profile.
```

Those two errors mean different things and are worth telling apart before
raising anything with Apple. The first says "you have it, not for this profile
type"; the second says "you do not have it".

### Checking which profiles carry it

```bash
DIR="$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"
for f in "$DIR"/*.mobileprovision; do
  P=$(security cms -D -i "$f" 2>/dev/null)
  A=$(echo "$P" | plutil -extract Entitlements.application-identifier raw - 2>/dev/null)
  case "$A" in *atmosmedia*)
    echo "$(echo "$P" | plutil -extract Name raw - 2>/dev/null) | tapToPay=$(echo "$P" \
      | plutil -extract Entitlements xml1 -o - - 2>/dev/null | grep -c proximity-reader)";;
  esac
done
```

Deleting the stale ones and letting Xcode re-fetch does not help if the grant
itself is development-only. It is worth doing once to rule caching out, then
stop.

### Likely causes, in order

1. **The grant covers development only.** Apple's approval is per environment;
   distribution can lag or need a second request.
2. **No App Store Connect app record.** Apple has been observed to withhold
   payment-acceptance entitlements from distribution profiles for a bundle id
   that has no app record. Creating the record costs nothing and rules it out.
3. **Propagation.** Rare, but the App ID capability can take time to reach the
   distribution profile service.

## Building for a device

The path that works today. Development signing, so the development profile —
the one that carries the capability — is the one that gets used.

```bash
cd mobile
npx expo prebuild -p ios --no-install && npx pod-install
xcodebuild build -workspace ios/Atmos.xcworkspace -scheme Atmos \
  -configuration Release -destination "id=<device-udid>" \
  -derivedDataPath build/dd DEVELOPMENT_TEAM=QB4T85D6S2 -allowProvisioningUpdates
xcrun devicectl device install app --device <device-udid> \
  build/dd/Build/Products/Release-iphoneos/Atmos.app
```

Get the udid from `xcrun devicectl list devices`. **Unlock the phone before
installing** — a locked device fails with `kAMDMobileImageMounterDeviceLocked`,
which reads like a developer disk image problem and is not one.

Release rather than Debug matters: `tap-to-pay.tsx` passes `simulated: __DEV__`,
so a Debug build connects to a simulated reader and proves nothing about the
entitlement.

### Push environment

`app.config.ts` reads `aps-environment` from `APS_ENVIRONMENT`, defaulting to
`development`. A development profile only carries the development value, so
hardcoding production breaks exactly the device builds needed to test Tap to
Pay. `scripts/build-ipa.sh` sets it to production for store builds, which is
where the production value belongs.

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
