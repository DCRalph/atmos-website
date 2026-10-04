/**
 * Reading a short link click: what kind of device, and where it came from.
 * Pure, so it is tested directly; `~/server/short-links` feeds it headers.
 */

/* -------------------------------------------------------------------------- */
/* What kind of device                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Anything that fetches a URL without a person behind it.
 *
 * A link pasted into a group chat is fetched once by every preview generator
 * that sees it, so without this a share to three people would read as a
 * dozen clicks. Bots are recorded, then left out of every total.
 */
const BOT =
  /bot\b|crawler|spider|slurp|facebookexternalhit|slackbot|discordbot|telegrambot|whatsapp|preview|headless|lighthouse|monitoring|curl|wget|python-requests|node-fetch|go-http|axios|okhttp/i;

const TABLET = /ipad|tablet|playbook|silk|kindle|android(?!.*mobi)/i;
const MOBILE = /mobi|iphone|ipod|android|blackberry|iemobile|opera mini/i;

/**
 * In-app browsers first, then real ones.
 *
 * Order is the whole trick: Instagram's webview says it is Chrome, Chrome says
 * it is Safari, and Edge says it is both. The first pattern to match wins, so
 * the most specific claim is tested first. The in-app entries matter most: a
 * story sticker sends everybody through Instagram's own browser.
 */
const BROWSERS: [RegExp, string][] = [
  [/instagram/i, "Instagram"],
  [/\b(fban|fbav|fb_iab)\b/i, "Facebook"],
  [/bytedancewebview|musical_ly|tiktok/i, "TikTok"],
  [/snapchat/i, "Snapchat"],
  [/threads/i, "Threads"],
  [/twitter/i, "X"],
  [/linkedinapp/i, "LinkedIn"],
  [/\bline\//i, "LINE"],
  [/pinterest/i, "Pinterest"],
  [/edg[ea]?\//i, "Edge"],
  [/opr\/|opera/i, "Opera"],
  [/samsungbrowser/i, "Samsung Internet"],
  [/firefox|fxios/i, "Firefox"],
  [/crios|chrome|chromium/i, "Chrome"],
  [/safari/i, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/iphone|ipad|ipod|ios/i, "iOS"],
  [/android/i, "Android"],
  [/windows/i, "Windows"],
  [/mac os x|macintosh/i, "macOS"],
  [/cros/i, "ChromeOS"],
  [/linux|ubuntu/i, "Linux"],
];

function firstMatch(patterns: [RegExp, string][], value: string) {
  return patterns.find(([pattern]) => pattern.test(value))?.[1] ?? "Other";
}

export type ClientInfo = {
  device: "mobile" | "tablet" | "desktop" | "bot" | "unknown";
  os: string;
  browser: string;
};

/**
 * A user agent reduced to the three things worth keeping.
 *
 * Deliberately coarse and hand-rolled: the alternative is a dependency that
 * ships a megabyte of regexes to answer "phone or laptop", about a string that
 * is self-reported anyway. `sec-ch-ua-mobile` is the browser saying so
 * directly, so it settles phone-or-not for the browsers that send it.
 */
export function readClient(
  userAgent: string,
  mobileHint: string | null,
): ClientInfo {
  if (!userAgent) return { device: "unknown", os: "Other", browser: "Other" };
  if (BOT.test(userAgent)) {
    return { device: "bot", os: "Other", browser: "Other" };
  }

  const device = TABLET.test(userAgent)
    ? "tablet"
    : mobileHint === "?1" || MOBILE.test(userAgent)
      ? "mobile"
      : "desktop";

  return {
    device,
    os: firstMatch(SYSTEMS, userAgent),
    browser: firstMatch(BROWSERS, userAgent),
  };
}

/* -------------------------------------------------------------------------- */
/* Where the click came from                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Hosts that say less than the thing they stand for. Instagram's outbound
 * links arrive from `l.instagram.com`, and nobody wants to read that in a
 * table next to `instagram`.
 */
const KNOWN_HOSTS: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)facebook\.com$/, "facebook"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)(twitter\.com|x\.com|t\.co)$/, "x"],
  [/(^|\.)google\./, "google"],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, "youtube"],
  [/(^|\.)linktr\.ee$/, "linktree"],
  [/(^|\.)spotify\.com$/, "spotify"],
  [/(^|\.)reddit\.com$/, "reddit"],
];

/**
 * Where a click came from, in one word.
 *
 * A named QR code is resolved before this is reached. Otherwise a tag — a
 * `utm_source` or `ref` on the link itself — wins, because it is the only thing
 * that survives the places that send no referrer at all: Instagram stories,
 * every messaging app, and anything printed. Failing that it is the referring
 * site, and failing that "direct", which covers both a typed URL and an app
 * that strips the header.
 */
export function resolveSource(tag: string | null, referrer: string | null) {
  if (tag?.trim()) return tag.trim().toLowerCase().slice(0, 48);

  if (!referrer) return "direct";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    return (
      KNOWN_HOSTS.find(([pattern]) => pattern.test(host))?.[1] ??
      host.slice(0, 48)
    );
  } catch {
    return "direct";
  }
}

/* -------------------------------------------------------------------------- */
/* Named QR codes                                                             */
/* -------------------------------------------------------------------------- */

/** No 0/o, 1/l/i: a code sometimes gets read aloud off a proof. */
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/**
 * Five random characters: 28 million per link, so a clash is not worth a
 * retry loop. The unique index refuses one anyway.
 */
export function newQrCode(): string {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(5)),
    (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length],
  ).join("");
}
