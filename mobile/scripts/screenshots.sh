#!/usr/bin/env bash
#
# App Store screenshots, from a simulator.
#
#   ./scripts/screenshots.sh [simulator-udid]
#
# Writes 1320x2868 PNGs to appstore/screenshots/iphone-6.9/, which is the only
# size Apple requires for an iPhone-only app — it scales that set down for the
# smaller classes itself.
#
# The captures come off a **Release** build talking to production, so what ends
# up in the listing is the app a customer downloads, with real gigs in it, and
# not a dev build with a debug banner and seed data.
#
# --- Why this drives the app the way it does ------------------------------
#
# There is no tap in here, because there is no way to send one. `simctl` has no
# tap or key command; AppleScript can click the Simulator window but only with
# Accessibility permission, which a CI box and a fresh laptop both lack; and
# `simctl openurl` with the atmos:// scheme raises an "Open in Atmos?" alert
# that itself needs a tap to dismiss, so deep links cannot bootstrap themselves.
#
# What is left is to make the app *open* on the screen being captured. This
# temporarily inserts a `router.replace` into the root layout, rebuilds, shoots,
# and puts the file back — the trap restores it even if the build fails or the
# script is interrupted. The rebuild is JS-only, so it is a bundle and an
# install rather than a full compile.
#
# Swapping main.jsbundle inside the installed .app instead does not work:
# expo-updates owns the bundle in a Release build and serves its own embedded
# copy, so the swapped file is ignored and you screenshot the old screen without
# any sign that it did not take.
set -euo pipefail

cd "$(dirname "$0")/.."
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

SIM="${1:-}"
if [ -z "$SIM" ]; then
  # Any booted 6.9" device, else the first iPhone 17 Pro Max on the machine.
  SIM="$(xcrun simctl list devices booted -j | python3 -c "
import json,sys
d=json.load(sys.stdin)['devices']
for rt in d.values():
    for dev in rt:
        if 'Pro Max' in dev['name']: print(dev['udid']); raise SystemExit
" 2>/dev/null || true)"
fi
if [ -z "$SIM" ]; then
  SIM="$(xcrun simctl list devices available -j | python3 -c "
import json,sys
d=json.load(sys.stdin)['devices']
for rt in d.values():
    for dev in rt:
        if 'Pro Max' in dev['name']: print(dev['udid']); raise SystemExit
")"
  xcrun simctl boot "$SIM"
fi
[ -n "$SIM" ] || { echo "error: no Pro Max simulator found" >&2; exit 1; }

OUT="appstore/screenshots/iphone-6.9"
BUNDLE_ID="nz.co.atmosmedia.app"
LAYOUT="app/_layout.tsx"
BACKUP="$(mktemp)"

mkdir -p "$OUT"
cp "$LAYOUT" "$BACKUP"
restore() { cp "$BACKUP" "$LAYOUT"; rm -f "$BACKUP"; }
trap restore EXIT

open -a Simulator || true
xcrun simctl bootstatus "$SIM" -b >/dev/null 2>&1 || true

# Apple's own screenshots read 9:41 with a full battery and full bars. A real
# capture otherwise ships "Carrier", a half battery and whatever the clock said,
# which is the difference between a listing that looks made and one that looks
# grabbed.
xcrun simctl status_bar "$SIM" override \
  --time "9:41" \
  --dataNetwork wifi --wifiMode active --wifiBars 3 \
  --cellularMode active --cellularBars 4 \
  --batteryState charged --batteryLevel 100 >/dev/null 2>&1 || true

# `ATMOS_SHOTS=04,06 ./scripts/screenshots.sh` re-shoots only those. Each screen
# costs a rebuild, so redoing one after a fix should not cost the other seven.
ONLY="${ATMOS_SHOTS:-}"

shoot() { # <output-name> <route>
  local name="$1" route="$2"

  if [ -n "$ONLY" ] && ! printf '%s' ",$ONLY," | grep -q ",${name%%-*},"; then
    echo "==> $name  (skipped)"
    return 0
  fi

  cp "$BACKUP" "$LAYOUT"

  python3 - "$LAYOUT" "$route" <<'PY'
import sys
path, route = sys.argv[1], sys.argv[2]
src = open(path).read()
src = src.replace(
    'import { Stack } from "expo-router";',
    'import { Stack, useRouter } from "expo-router";\nimport { useEffect } from "react";',
)
src = src.replace(
    "export default function RootLayout() {\n  return (",
    "export default function RootLayout() {\n"
    "  const __shotRouter = useRouter();\n"
    "  useEffect(() => {\n"
    "    const t = setTimeout(() => __shotRouter.replace(\"%s\"), 600);\n"
    "    return () => clearTimeout(t);\n"
    "  }, []);\n"
    "  return (" % route,
)
open(path, "w").write(src)
PY

  echo "==> $name  ($route)"
  # `--no-bundler`, or expo starts a Metro server after installing and never
  # exits — a Release build carries its bundle embedded and needs no server.
  npx expo run:ios --device "$SIM" --configuration Release --no-bundler >"/tmp/shot-$name.log" 2>&1 || true

  # `expo run:ios` ends by opening a dev-client URL, which is not what a Release
  # build wants. Relaunch by bundle id so every capture is a clean cold start
  # landing on the route above.
  xcrun simctl terminate "$SIM" "$BUNDLE_ID" >/dev/null 2>&1 || true
  sleep 1
  xcrun simctl launch "$SIM" "$BUNDLE_ID" >/dev/null 2>&1 || true

  # The app has to finish launching, resolve the route and load real data over
  # the network before there is anything worth photographing.
  sleep 12

  # Retried rather than trusted. The simulator restarts under `expo run:ios`,
  # and a capture aimed at it mid-restart fails — which, under `set -e`, used to
  # take the whole run down after one screen and leave the rest unexplained.
  local attempt
  for attempt in 1 2 3; do
    if xcrun simctl io "$SIM" screenshot "$OUT/$name.png" >/dev/null 2>&1; then
      break
    fi
    echo "    capture failed, retrying ($attempt/3)"
    sleep 6
  done

  if [ ! -f "$OUT/$name.png" ]; then
    echo "    !! no screenshot for $name — continuing"
    return 0
  fi

  local dims
  dims="$(sips -g pixelWidth -g pixelHeight "$OUT/$name.png" | awk '/pixel/{printf "%sx", $2} END{print ""}')"
  echo "    ${dims%x} -> $OUT/$name.png"
}

# Three gig pages rather than one, on purpose. The layout is the same each time
# but the poster is the whole screen, so a listing built from one gig reads as
# three pictures of the same blue poster. These are picked to disagree: a bright
# photographic one, a dark cinematic one, and whatever is coming up next.
shoot 01-home        "/"
shoot 02-gigs        "/gigs"
shoot 03-gig-next    "/gigs/${ATMOS_SHOT_GIG_ID:-cmt7wg2f9000004jrkpjgumnn}"
shoot 04-gig-bright  "/gigs/${ATMOS_SHOT_GIG_BRIGHT:-cmrvwb9tn000004l7890pct2h}"
shoot 05-gig-dark    "/gigs/${ATMOS_SHOT_GIG_DARK:-cmpc99mni000004kw616dx45z}"
shoot 06-sign-in     "/sign-in"
shoot 07-tickets     "/tickets"
shoot 08-more        "/more"

restore
trap - EXIT

echo
echo "==> Done"
ls -1 "$OUT"/*.png
echo
echo "Apple requires the 6.9in set only; it scales the rest."
