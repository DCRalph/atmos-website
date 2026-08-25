#!/usr/bin/env bash
#
# Build a device-signed .ipa and install it straight onto an iPhone.
#
#   ./scripts/install-ios.sh [device]
#
# `device` is a devicectl device name or UDID ("Will", 00008130-...). Without
# it, the first available iPhone is used. Names with spaces need quoting.
#
# This is the sibling of build-ipa.sh with the opposite signing story: that
# script exports for App Store Connect (production push, no Tap to Pay, upload
# via Transporter), while this one keeps the device entitlements that
# app.config.ts emits by default (development push, Tap to Pay) and signs with
# a development profile, which is the only kind of signature a phone will
# accept outside the App Store. A store .ipa can never be installed this way.
set -euo pipefail

cd "$(dirname "$0")/.."

# CocoaPods dies without a UTF-8 locale — see the note in build-ipa.sh.
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

TEAM_ID="QB4T85D6S2"
BUNDLE_ID="nz.co.atmosmedia.app"
OUT="$PWD/build"
ARCHIVE="$OUT/AtmosDev.xcarchive"

fail() { echo "error: $*" >&2; exit 1; }

# ---------------------------------------------------------------- 0. device

# The list is fixed-width columns three-plus spaces apart: Name, Hostname,
# Identifier, State, Model. Matching the State column against `^available`
# matters — a bare /available/ also matches "unavailable", which once aimed a
# ten-minute build at a phone that had gone to sleep. The identifier comes
# back rather than the name, so a name with spaces cannot break the install.
pick_device() {
  xcrun devicectl list devices 2>/dev/null |
    awk -F '   +' '$5 ~ /iPhone/ && $4 ~ /^available/ {print $3; exit}'
}

DEVICE="${1:-}"
if [ -z "$DEVICE" ]; then
  # CoreDevice drops a phone from this list for a few seconds around tunnel
  # activity (an install or launch that just finished), so poll briefly rather
  # than failing on the first empty read.
  for _ in 1 2 3 4 5; do
    DEVICE="$(pick_device)"
    [ -n "$DEVICE" ] && break
    sleep 3
  done
  [ -n "$DEVICE" ] ||
    fail "no available iPhone found — unlock it or plug it in, or pass a device name or UDID"
fi
echo "==> Installing to: $DEVICE"

# -------------------------------------------------------------- 1. prebuild

# ios/ is regenerated every time because build-ipa.sh leaves it holding store
# entitlements, and a stale tree is how the wrong ones reach the device.
echo "==> Prebuilding (device entitlements)"
rm -rf ios
npx expo prebuild -p ios --no-install >/dev/null
npx pod-install >/dev/null

# ---------------------------------------------------------------- 2. archive

echo "==> Archiving"
# Fresh builds of this workspace occasionally lose a CompileC race between the
# pod script phases; the immediate retry is incremental and lands every time.
archive() {
  xcodebuild archive \
    -workspace ios/Atmos.xcworkspace \
    -scheme Atmos \
    -configuration Release \
    -destination 'generic/platform=iOS' \
    -archivePath "$ARCHIVE" \
    DEVELOPMENT_TEAM="$TEAM_ID" \
    -allowProvisioningUpdates \
    -quiet
}
archive || { echo "==> Archive failed, retrying once"; archive; }

[ -d "$ARCHIVE/Products/Applications/Atmos.app" ] || fail "archive produced no app"

# ----------------------------------------------------------------- 3. export

echo "==> Exporting a device-signed .ipa"
rm -rf "$OUT/device"
cat > "$OUT/ExportOptionsDevice.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>debugging</string>
  <key>teamID</key><string>$TEAM_ID</string>
  <key>signingStyle</key><string>automatic</string>
  <key>destination</key><string>export</string>
</dict>
</plist>
PLIST

# System paths first so Apple's rsync wins — see the note in build-ipa.sh.
PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH" xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$OUT/ExportOptionsDevice.plist" \
  -exportPath "$OUT/device" \
  -allowProvisioningUpdates \
  -quiet

IPA="$(ls "$OUT/device"/*.ipa 2>/dev/null | head -1)"
[ -n "$IPA" ] || fail "export produced no .ipa in $OUT/device"

# ---------------------------------------------------------------- 4. install

echo "==> Installing $(basename "$IPA")"
# The archive runs long enough for a phone to lock and drop its CoreDevice
# tunnel, so the install is retried while the phone reconnects rather than
# throwing the build away on the first refusal.
installed=false
for attempt in 1 2 3 4 5; do
  if xcrun devicectl device install app --device "$DEVICE" "$IPA"; then
    installed=true
    break
  fi
  echo "==> Install failed ($attempt/5) — is the phone awake and nearby? Retrying in 10s"
  sleep 10
done
[ "$installed" = true ] ||
  fail "could not reach $DEVICE — unlock the phone and rerun; the signed .ipa is already in $OUT/device"

# Best-effort: bring it to the front. Fails harmlessly if the phone is locked.
xcrun devicectl device process launch --device "$DEVICE" "$BUNDLE_ID" >/dev/null 2>&1 || true

echo
echo "==> Done — Atmos installed on $DEVICE"
