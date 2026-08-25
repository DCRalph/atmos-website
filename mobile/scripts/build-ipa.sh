#!/usr/bin/env bash
#
# Build an App Store .ipa for upload with Transporter.
#
#   ./scripts/build-ipa.sh [output-dir]
#
# One run, one uploadable .ipa: icons regenerated from the logo, version and
# build number resolved, archive signed and exported, and the result checked
# against what was asked for before it says Done.
#
# Environment overrides, all optional:
#
#   BUILD_NUMBER   CFBundleVersion. Default is minutes since 2025-01-01 UTC.
#   APP_VERSION    CFBundleShortVersionString. Default is package.json.
#   SKIP_ICONS=1   Leave assets/ alone (they need sharp, and a network-less
#                  machine may not have it).
#
# --- Why the middle of this is not a single xcodebuild call ---------------
#
# Several frameworks vendored by expo-image and expo-camera (SDWebImage and its
# coders, libavif, ZXingObjC) ship with a CFBundleIdentifier of `-pkg.<name>`.
# Identifiers may not begin with a hyphen. Xcode archives them without complaint
# and then fails the App Store export with "Copy failed", naming nothing.
#
# It cannot be fixed in the Podfile: those xcframeworks are fetched during the
# build rather than at pod-install time, so there is nothing on disk to rewrite
# beforehand. Patching the archive is the earliest point they exist, and the
# identifiers are internal — nothing resolves the app through them.
#
# Rewriting Info.plist alone is not enough. A code signature carries its own
# identifier, and exportArchive re-signs with --preserve-metadata=identifier, so
# the old value survives into the .ipa and App Store Connect rejects the upload:
#
#   Invalid Code Signature Identifier. The identifier "-pkg.libavif" in your
#   code signature for "libavif" must match its Bundle Identifier
#   "nz.co.atmosmedia.app.pod.libavif"
#
# So each patched framework is re-signed with an explicit --identifier. That is
# what export then preserves.
set -euo pipefail

cd "$(dirname "$0")/.."

# CocoaPods runs the project path through Ruby's `unicode_normalize`, which
# raises on a path Ruby has read as ASCII-8BIT:
#
#   Unicode Normalization not appropriate for ASCII-8BIT
#   (Encoding::CompatibilityError)
#
# That happens whenever the shell has no UTF-8 locale, which a non-interactive
# or agent-launched shell frequently does not. `pod install` then dies before it
# has even looked at the Podfile, so the failure names nothing in this project
# and reads as a CocoaPods bug rather than a missing environment variable.
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

TEAM_ID="QB4T85D6S2"
BUNDLE_ID="nz.co.atmosmedia.app"
SIGN_ID="Apple Distribution: William Giles ($TEAM_ID)"
OUT="${1:-$PWD/build}"
ARCHIVE="$OUT/Atmos.xcarchive"
APP="$ARCHIVE/Products/Applications/Atmos.app"

fail() { echo "error: $*" >&2; exit 1; }

# ---------------------------------------------------------------- 0. identity

VERSION="${APP_VERSION:-$(node -p "require('./package.json').version")}"
[ -n "$VERSION" ] || fail "could not read a version from package.json"

# The build number has one job: be larger than every build number App Store
# Connect has already seen for this version. A git commit count reads nicer but
# collides the moment you rebuild the same commit — which is exactly what you do
# when an upload fails and you fix something outside the tree. Minutes since
# 2025-01-01 UTC cannot collide, stays six digits for the next century, and
# still sorts chronologically.
#
# Which commit a build came from is a separate question, answered by
# ATMOSGitCommit in Info.plist rather than by overloading this number.
EPOCH=1735689600 # 2025-01-01T00:00:00Z
BUILD="${BUILD_NUMBER:-$((($(date -u +%s) - EPOCH) / 60))}"
[ "$BUILD" -gt 0 ] 2>/dev/null || fail "build number '$BUILD' is not a positive integer"

GIT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo dev)"
if ! git diff --quiet HEAD 2>/dev/null; then
  GIT_COMMIT="$GIT_COMMIT-dirty"
  echo "!!  Working tree is dirty. Marking this build $GIT_COMMIT."
fi

export APP_VERSION="$VERSION"
export BUILD_NUMBER="$BUILD"
export GIT_COMMIT

# A store build talks to production APNs.
export APS_ENVIRONMENT=production

# Apple granted Tap to Pay for development only. An App Store profile is issued
# without the capability, so claiming the entitlement fails the export with
# "doesn't include the Tap to Pay on iPhone capability". Ship without it; the
# sell sheet reports Tap to Pay as unavailable and staff take cash. Drop this
# line once Apple extends the grant to distribution.
export TAP_TO_PAY=0

echo "==> Atmos $VERSION ($BUILD) — $GIT_COMMIT"

mkdir -p "$OUT"
rm -rf "$ARCHIVE" "$OUT/export"

# ------------------------------------------------------------------- 1. icons

# Regenerated rather than trusted. The icons in assets/ are derived from
# public/logo/atmos-white.png, and nothing else in the build would notice if the
# logo moved on and they did not — the app would simply ship the old mark.
if [ "${SKIP_ICONS:-0}" = "1" ]; then
  echo "==> Icons: skipped (SKIP_ICONS=1)"
else
  echo "==> Regenerating icons from the logo"
  node scripts/make-icons.mjs
fi

# The App Store rejects an icon with an alpha channel, and the rejection arrives
# by email twenty minutes after upload. Two seconds here instead.
if [ "$(sips -g hasAlpha assets/icon.png 2>/dev/null | awk '/hasAlpha/{print $2}')" = "yes" ]; then
  fail "assets/icon.png has an alpha channel — the App Store will reject it"
fi

# ---------------------------------------------------------------- 2. prebuild

# ios/ is removed rather than passing --clean, which is interactive. It is
# generated and gitignored, so there is nothing in it to keep, and a stale one is
# how a changed app.config.ts fails to reach the archive.
echo "==> Prebuilding (store entitlements, no Tap to Pay)"
rm -rf ios
npx expo prebuild -p ios --no-install >/dev/null
npx pod-install >/dev/null

# Prebuild is the step that turns the config above into a plist. If it did not,
# nothing downstream will fix it, and the failure would otherwise surface as a
# duplicate-build-number rejection from Apple rather than as itself.
GENERATED_VERSION="$(plutil -extract CFBundleShortVersionString raw ios/Atmos/Info.plist)"
GENERATED_BUILD="$(plutil -extract CFBundleVersion raw ios/Atmos/Info.plist)"
[ "$GENERATED_VERSION" = "$VERSION" ] ||
  fail "prebuild wrote version $GENERATED_VERSION, expected $VERSION"
[ "$GENERATED_BUILD" = "$BUILD" ] ||
  fail "prebuild wrote build $GENERATED_BUILD, expected $BUILD"

# ----------------------------------------------------------------- 3. archive

echo "==> Archiving"
xcodebuild archive \
  -workspace ios/Atmos.xcworkspace \
  -scheme Atmos \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  MARKETING_VERSION="$VERSION" \
  CURRENT_PROJECT_VERSION="$BUILD" \
  -allowProvisioningUpdates \
  -quiet

[ -d "$APP" ] || fail "archive produced no app at $APP"

echo "==> Fixing framework bundle identifiers"
find "$APP/Frameworks" -maxdepth 1 -name "*.framework" 2>/dev/null | while read -r fw; do
  plist="$fw/Info.plist"
  [ -f "$plist" ] || continue
  id=$(plutil -extract CFBundleIdentifier raw "$plist" 2>/dev/null || echo "")
  case "$id" in
    -*|*.-*)
      safe="$BUNDLE_ID.pod.$(basename "$fw" .framework | tr -cd '[:alnum:]')"
      plutil -replace CFBundleIdentifier -string "$safe" "$plist"
      codesign --force --sign "$SIGN_ID" --identifier "$safe" "$fw" 2>/dev/null
      echo "    $id -> $safe"
      ;;
  esac
done

# ------------------------------------------------------------------ 4. export

echo "==> Exporting for the App Store"
cat > "$OUT/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>$TEAM_ID</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
  <key>destination</key><string>export</string>
</dict>
</plist>
PLIST

# Xcode's IPA packaging step shells out to `rsync`, and expects Apple's
# openrsync (2.6.9 compatible) at /usr/bin/rsync. A Homebrew rsync 3.x earlier
# on PATH speaks a protocol it cannot parse, and the step dies as:
#
#   rsync error: syntax or usage error (code 1) at main.c(1784) [server=3.4.2]
#
# which xcodebuild reports only as "Copy failed" — the same words as the invalid
# bundle identifier failure above, from an unrelated cause. System paths first
# so the Apple binary wins.
PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH" xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$OUT/ExportOptions.plist" \
  -exportPath "$OUT/export" \
  -allowProvisioningUpdates

IPA="$(ls "$OUT/export"/*.ipa 2>/dev/null | head -1)"
[ -n "$IPA" ] || fail "export produced no .ipa in $OUT/export"

# ------------------------------------------------------------------ 5. verify

# Everything above is a step that has silently produced the wrong thing at least
# once. This opens the artefact that is about to be uploaded and reads back what
# it actually says, so a bad build fails here rather than in an email from Apple
# twenty minutes later.
echo "==> Verifying the .ipa"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
unzip -q "$IPA" -d "$STAGE"
PAYLOAD="$STAGE/Payload/Atmos.app"
[ -d "$PAYLOAD" ] || fail "no Payload/Atmos.app inside the .ipa"

check() { # name expected actual
  if [ "$2" = "$3" ]; then
    printf '    ok   %-26s %s\n' "$1" "$3"
  else
    fail "$1 is '$3', expected '$2'"
  fi
}

check "CFBundleIdentifier"        "$BUNDLE_ID" "$(plutil -extract CFBundleIdentifier raw "$PAYLOAD/Info.plist")"
check "CFBundleShortVersionString" "$VERSION"  "$(plutil -extract CFBundleShortVersionString raw "$PAYLOAD/Info.plist")"
check "CFBundleVersion"           "$BUILD"     "$(plutil -extract CFBundleVersion raw "$PAYLOAD/Info.plist")"
check "ATMOSGitCommit"            "$GIT_COMMIT" "$(plutil -extract ATMOSGitCommit raw "$PAYLOAD/Info.plist")"

# The icon is the one thing a human notices immediately and a script never
# checks. An app that ships without it shows a white tile on the home screen.
ICON="$PAYLOAD/AppIcon60x60@2x.png"
[ -f "$ICON" ] || fail "no AppIcon60x60@2x.png in the bundle — the app would ship iconless"
check "icon alpha" "no" "$(sips -g hasAlpha "$ICON" 2>/dev/null | awk '/hasAlpha/{print $2}')"
printf '    ok   %-26s %s\n' "icon" "$(basename "$ICON") $(sips -g pixelWidth "$ICON" | awk '/pixelWidth/{print $2}')px"

# The two entitlements this script exists to get right, read back off the signed
# binary rather than off the config that was supposed to produce them.
ENTS="$(codesign -d --entitlements - --xml "$PAYLOAD" 2>/dev/null | plutil -convert xml1 -o - - 2>/dev/null || true)"
case "$ENTS" in
  *aps-environment*production*) printf '    ok   %-26s %s\n' "aps-environment" "production" ;;
  *) fail "aps-environment is not production — push would silently never arrive" ;;
esac
case "$ENTS" in
  *proximity-reader*) fail "Tap to Pay entitlement present — the App Store profile does not carry it" ;;
  *) printf '    ok   %-26s %s\n' "tap-to-pay entitlement" "absent (correct for store)" ;;
esac

# Sign in with Apple. App Store Guideline 4.8 requires it wherever a
# third-party social login is offered, and the sign-in screen offers Google.
# Without the entitlement the button is on screen and cannot work, which is a
# rejection either way — better to fail here.
case "$ENTS" in
  *applesignin*) printf '    ok   %-26s %s\n' "sign in with apple" "present" ;;
  *) fail "Sign in with Apple entitlement missing — Guideline 4.8. Enable the capability on the App ID and regenerate the profiles" ;;
esac

# Associated domains. Without this the emailed ticket links open Safari rather
# than the app, silently, and the only symptom is that universal links never
# work. The site half of it is the /.well-known/apple-app-site-association
# route handler.
case "$ENTS" in
  *associated-domains*) printf '    ok   %-26s %s\n' "associated domains" "present" ;;
  *) fail "associated-domains entitlement missing — ticket links would open Safari instead of the app" ;;
esac

# ------------------------------------------------------------------- 6. done

echo
echo "==> Done"
printf '    %s\n' "$IPA"
printf '    %s  %s\n' "$(du -h "$IPA" | cut -f1)" "Atmos $VERSION ($BUILD) — $GIT_COMMIT"
echo
echo "Open Transporter, sign in, and drop the .ipa above onto it."
