#!/usr/bin/env python3
"""
The App Review walkthrough video, recorded off a simulator.

    APP_REVIEW_PASSWORD=... python3 appstore/review-video/record.py [segment ...]

Writes `appstore/review-video/out/atmos-app-review.mp4`: a title card, one
captioned clip per segment below, and an end card. Name segments to re-record
only those; the rest are reused from `out/raw/`.

Needs, on the machine:
  - Maestro (https://maestro.dev), which drives the app — `simctl` cannot tap.
  - ffmpeg, and Pillow for the caption panels.
  - A booted iPhone simulator with a Release build of the app installed (`SIM`
    picks one by UDID). It talks to whatever `EXPO_PUBLIC_API_URL` it was
    built with.
  - The review accounts from `bun run db:seed-app-review`. Run the seed again
    afterwards: recording checks people in and sells a ticket, and the reviewer
    should start from a clean demo night.

Apple says a video does not replace demo accounts. This exists to show what
one review device cannot: the door flow end to end, and checkout.
"""

import json
import os
import signal
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
RAW = OUT / "raw"
FLOWS = HERE / "flows"

API_URL = os.environ.get("API_URL", "https://atmosmedia.co.nz")
PASSWORD = os.environ.get("APP_REVIEW_PASSWORD", "")
CUSTOMER = "review-customer@atmosmedia.co.nz"

# Portrait 1080p. The phone sits under a caption panel rather than under text
# drawn over it, so no caption ever hides the screen it is describing.
W, H, FPS = 1080, 1920, 30
PANEL = 330
FONT = "/System/Library/Fonts/SFNS.ttf"
WORDMARK = HERE.parent.parent / "assets" / "atmos-wordmark.png"

# The app's own tokens (`src/lib/theme.ts`), so the video reads as Atmos.
TEXT = (255, 255, 255)
SOFT = (158, 158, 158)  # textSoft on black
FAINT = (97, 97, 97)  # textFaint on black
BORDER = (36, 36, 36)

SEGMENTS = [
    ("browse", "Signed out", "What's on", "Home and Gigs work without an account. Each gig has its line-up, times and venue."),
    ("sign-in", "Customer account", "Sign in", "Sign in with Apple, Google, or email and password. This is the customer demo account."),
    ("tickets", "Customer account", "Your tickets", "Every ticket has its own QR code, and adds to Apple Wallet."),
    ("checkout", "Customer account", "Buying tickets", "Shown on the demo night: a gig's Tickets button opens this when Atmos sells it. Payment is Stripe's sheet."),
    ("account", "Customer account", "Your account", "Delete account is in the app, under More. Then sign out, to switch to the door staff account."),
    ("door-sign-in", "Door staff account", "Door staff", "Staff sign in to the same app. Tap to Pay on iPhone is announced once, to staff only."),
    ("door", "Door staff account", "Door mode", "The door for tonight: scan or type a ticket, find somebody on the list, see the log."),
    ("sell", "Door staff account", "Selling at the door", "Tap to Pay on iPhone is always first. It is unavailable here, so this sale is recorded as cash."),
    ("id-check", "Door staff account", "ID checks", "Record an ID check against the night. Under 18s are refused, as every Atmos event is R18."),
    ("staff-tools", "Door staff account", "Run sheet and Tap to Pay guides", "The night's running order, and Apple's Tap to Pay on iPhone setup and education."),
]


def font(size: int, weight: str) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(FONT, size)
    f.set_variation_by_name(weight)
    return f


def tracked(draw, xy, text, fnt, fill, tracking=0.0):
    """Draw text with letter spacing, which Pillow does not do by itself."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + tracking
    return x


def wrap(draw, text, fnt, width):
    lines, line = [], ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if draw.textlength(trial, font=fnt) <= width:
            line = trial
        else:
            lines.append(line)
            line = word
    return lines + [line]


def panel(index: int, eyebrow: str, title: str, detail: str) -> Image.Image:
    """The caption above the phone: eyebrow, heavy uppercase title, one line of detail."""
    img = Image.new("RGB", (W, PANEL), (0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = 72
    tracked(d, (pad, 64), f"{index:02d}  ·  {eyebrow.upper()}", font(26, "Heavy"), FAINT, 3.5)
    # Shrunk until it fits on one line, so a long title never runs off the edge.
    size = 64
    while size > 40 and d.textlength(title.upper(), font=font(size, "Black")) - 1.2 * len(title) > W - pad * 2:
        size -= 2
    tracked(d, (pad, 108 + (64 - size) // 2), title.upper(), font(size, "Black"), TEXT, -1.2)
    for i, line in enumerate(wrap(d, detail, font(31, "Regular"), W - pad * 2)):
        d.text((pad, 200 + i * 42), line, font=font(31, "Regular"), fill=SOFT)
    d.line([(0, PANEL - 1), (W, PANEL - 1)], fill=BORDER, width=2)
    return img


def card(lines: list[tuple[str, int, str, tuple]]) -> Image.Image:
    """A full-frame card: the wordmark, then centred lines of (text, size, weight, colour)."""
    img = Image.new("RGB", (W, H), (0, 0, 0))
    d = ImageDraw.Draw(img)
    mark = Image.open(WORDMARK).convert("RGBA")
    mark = mark.resize((620, int(620 * mark.height / mark.width)))
    y = 700
    img.paste(mark, ((W - mark.width) // 2, y - mark.height), mark)
    y += 70
    for text, size, weight, colour in lines:
        f = font(size, weight)
        for line in wrap(d, text, f, W - 160):
            d.text(((W - d.textlength(line, font=f)) / 2, y), line, font=f, fill=colour)
            y += int(size * 1.45)
        y += 18
    return img


def run(*cmd, **kw):
    return subprocess.run(cmd, check=True, **kw)


def booted_iphone() -> str:
    if os.environ.get("SIM"):
        return os.environ["SIM"]
    devices = json.loads(subprocess.check_output(["xcrun", "simctl", "list", "devices", "booted", "-j"]))["devices"]
    for runtime in devices.values():
        for dev in runtime:
            if "iPhone" in dev["name"]:
                return dev["udid"]
    sys.exit("error: boot an iPhone simulator with the app installed first")


def customer_ticket_number() -> str:
    """The customer's first ticket number, so the door segment can admit it by hand."""
    def call(path, body=None, cookie=None):
        req = urllib.request.Request(f"{API_URL}{path}", data=json.dumps(body).encode() if body else None)
        req.add_header("content-type", "application/json")
        req.add_header("origin", "atmos://")
        if cookie:
            req.add_header("cookie", cookie)
        with urllib.request.urlopen(req) as res:
            return res.headers.get_all("set-cookie") or [], json.load(res)

    cookies, _ = call("/api/auth/sign-in/email", {"email": CUSTOMER, "password": PASSWORD})
    cookie = "; ".join(c.split(";")[0] for c in cookies)
    _, mine = call("/api/trpc/tickets.mine", cookie=cookie)
    token = mine["result"]["data"]["json"][0]["accessToken"]
    query = urllib.parse.quote(json.dumps({"json": {"accessToken": token}}))
    _, order = call(f"/api/trpc/tickets.byAccessToken?input={query}", cookie=cookie)
    return order["result"]["data"]["json"]["tickets"][0]["ticketNumber"]


def record(udid: str, segment: str, env: dict[str, str]):
    RAW.mkdir(parents=True, exist_ok=True)
    clip = RAW / f"{segment}.mp4"
    rec = subprocess.Popen(
        ["xcrun", "simctl", "io", udid, "recordVideo", "--codec=h264", "--force", str(clip)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(1.5)  # recordVideo drops the first moment while it starts
    args = ["maestro", "--device", udid, "test"]
    for key, value in env.items():
        args += ["-e", f"{key}={value}"]
    result = subprocess.run(args + [str(FLOWS / f"{segment}.yaml")])
    time.sleep(1)
    rec.send_signal(signal.SIGINT)
    rec.wait()
    if result.returncode != 0:
        sys.exit(f"error: the {segment} flow failed; the clip in {clip} shows where")


def still(image: Image.Image, seconds: float, out: Path):
    png = out.with_suffix(".png")
    image.save(png)
    run("ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-i", str(png), "-t", str(seconds),
        "-r", str(FPS), "-pix_fmt", "yuv420p", "-c:v", "libx264", str(out))


def captioned(index: int, segment: str, eyebrow: str, title: str, detail: str, out: Path):
    """Phone clip scaled under its caption panel, framed by a hairline like the app's cards."""
    png = OUT / f"panel-{segment}.png"
    panel(index, eyebrow, title, detail).save(png)
    phone_h = H - PANEL - 90
    run(
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", str(RAW / f"{segment}.mp4"), "-i", str(png),
        "-filter_complex",
        f"[0:v]fps={FPS},scale=-2:{phone_h},pad=iw+4:ih+4:2:2:color=0x242424[phone];"
        f"color=black:s={W}x{H}:r={FPS}[bg];"
        f"[bg][phone]overlay=(W-w)/2:{PANEL + 44}:shortest=1[v1];"
        f"[v1][1:v]overlay=0:0,format=yuv420p[v]",
        "-map", "[v]", "-c:v", "libx264", "-crf", "20", "-preset", "medium", str(out),
    )


def compose():
    parts = []
    title = OUT / "00-title.mp4"
    still(card([
        ("APP REVIEW WALKTHROUGH", 54, "Black", TEXT),
        ("Atmos 1.0 for iPhone", 34, "Regular", SOFT),
        ("Demo accounts and their passwords are in the App Review notes. "
         "The demo night and everyone on it are fictional.", 30, "Regular", FAINT),
    ]), 4, title)
    parts.append(title)
    for i, (segment, eyebrow, name, detail) in enumerate(SEGMENTS, start=1):
        out = OUT / f"{i:02d}-{segment}.mp4"
        captioned(i, segment, eyebrow, name, detail, out)
        parts.append(out)
    end = OUT / "99-end.mp4"
    still(card([
        ("THANK YOU", 54, "Black", TEXT),
        ("Questions: reply in App Store Connect.", 32, "Regular", SOFT),
    ]), 3, end)
    parts.append(end)

    listing = OUT / "parts.txt"
    listing.write_text("".join(f"file '{p}'\n" for p in parts))
    final = OUT / "atmos-app-review.mp4"
    run("ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(listing),
        "-c:v", "libx264", "-crf", "21", "-preset", "slow", "-movflags", "+faststart", str(final))
    print(final)


def main():
    if not PASSWORD:
        sys.exit("error: set APP_REVIEW_PASSWORD")
    wanted = sys.argv[1:] or [s[0] for s in SEGMENTS]
    udid = booted_iphone()
    # Apple's own screenshots say 9:41 with full bars; so does this.
    subprocess.run(["xcrun", "simctl", "status_bar", udid, "override", "--time", "9:41",
                    "--dataNetwork", "wifi", "--wifiBars", "3", "--cellularBars", "4",
                    "--batteryState", "charged", "--batteryLevel", "100"])
    env = {"PASSWORD": PASSWORD, "TICKET": customer_ticket_number()}
    if wanted[0] == SEGMENTS[0][0]:
        # A cold start, signed out, before the camera rolls.
        run("maestro", "--device", udid, "test", str(FLOWS / "_prepare.yaml"))
    for segment in wanted:
        print(f"==> {segment}")
        record(udid, segment, env)
    compose()


if __name__ == "__main__":
    main()
