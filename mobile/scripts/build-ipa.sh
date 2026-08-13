#!/usr/bin/env bash
#
# Build an App Store .ipa for upload with Transporter.
#
#   ./scripts/build-ipa.sh [output-dir]
#
# Three steps, and the middle one is the reason this is a script rather than a
# single xcodebuild call:
#
#   1. archive        — Release, generic iOS device
#   2. patch          — fix invalid framework bundle identifiers
#   3. exportArchive  — App Store signed, ready for Transporter
#
# Step 2 exists because several frameworks vendored by expo-image and
# expo-camera (SDWebImage and its coders, libavif, ZXingObjC) ship with a
# CFBundleIdentifier of `-pkg.<name>`. Identifiers may not begin with a hyphen.
# Xcode archives them without complaint and then fails the App Store export
# with "Copy failed", naming nothing.
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

TEAM_ID="QB4T85D6S2"
BUNDLE_ID="nz.co.atmosmedia.app"
SIGN_ID="Apple Distribution: William Giles ($TEAM_ID)"
OUT="${1:-$PWD/build}"
ARCHIVE="$OUT/Atmos.xcarchive"

mkdir -p "$OUT"
rm -rf "$ARCHIVE" "$OUT/export"

# A store build talks to production APNs.
export APS_ENVIRONMENT=production

# Apple granted Tap to Pay for development only. An App Store profile is issued
# without the capability, so claiming the entitlement fails the export with
# "doesn't include the Tap to Pay on iPhone capability". Ship without it; the
# sell sheet reports Tap to Pay as unavailable and staff take cash. Drop this
# line once Apple extends the grant to distribution.
export TAP_TO_PAY=0

echo "==> Prebuilding (store entitlements, no Tap to Pay)"
npx expo prebuild -p ios --no-install >/dev/null
npx pod-install >/dev/null

echo "==> Archiving"
xcodebuild archive \
  -workspace ios/Atmos.xcworkspace \
  -scheme Atmos \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  -allowProvisioningUpdates \
  -quiet

echo "==> Fixing framework bundle identifiers"
APP="$ARCHIVE/Products/Applications/Atmos.app"
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

echo
echo "==> Done"
ls -lh "$OUT/export"/*.ipa
echo
echo "Open Transporter, sign in, and drop the .ipa above onto it."
