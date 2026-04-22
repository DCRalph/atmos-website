export type SocialPlatformId =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "youtube"
  | "spotify"
  | "soundcloud";

export type SocialPlatform = {
  id: SocialPlatformId;
  name: string;
  iconSrc: string;
  /** Title attribute stored on the Lexical link node to tag it as a social pill. */
  pillTitle: string;
  /** Hostnames (without `www.`) that identify URLs belonging to this platform. */
  hosts: readonly string[];
  /** Whether the platform accepts a bare handle (e.g. `@atmos`) as input. */
  supportsHandleInput: boolean;
  /** Placeholder shown in the dialog input. */
  inputPlaceholder: string;
  /** Help text describing the accepted input format. */
  inputHelp?: string;
  /** Pill styling used by the public pill renderer. */
  pillClassName: string;
  /** Convert a raw input (handle or URL) into a canonical URL. */
  normalizeInput: (input: string) => string | null;
  /** Extract a handle from a canonical URL, if any. */
  extractHandle: (url: string) => string;
};

function parseUrl(input: string): URL | null {
  if (!/^https?:\/\//i.test(input)) return null;
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

function normalizedHost(url: URL): string {
  return url.hostname.replace(/^www\./, "").toLowerCase();
}

function pathHandle(url: URL): string {
  return url.pathname.replace(/^\/+|\/+$/g, "").split("/")[0] ?? "";
}

function makeHandleNormalizer(options: {
  baseUrl: string;
  handlePattern: RegExp;
  hosts: readonly string[];
  /** If true, the URL path is prefixed with `@`. */
  atPrefix?: boolean;
}): SocialPlatform["normalizeInput"] {
  return (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return null;

    const parsed = parseUrl(trimmed);
    if (parsed) {
      const host = normalizedHost(parsed);
      if (options.hosts.includes(host)) {
        return parsed.toString();
      }
      return null;
    }

    let handle = trimmed.replace(/^@/, "").replace(/\/+$/, "");
    if (!handle) return null;
    if (!options.handlePattern.test(handle)) return null;

    const path = options.atPrefix ? `@${handle}` : handle;
    return `${options.baseUrl.replace(/\/+$/, "")}/${path}`;
  };
}

function urlOnlyNormalizer(
  hosts: readonly string[],
): SocialPlatform["normalizeInput"] {
  return (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const parsed = parseUrl(trimmed);
    if (!parsed) return null;
    if (!hosts.includes(normalizedHost(parsed))) return null;
    return parsed.toString();
  };
}

function makeHandleExtractor(options: {
  hosts: readonly string[];
  stripAt?: boolean;
}): SocialPlatform["extractHandle"] {
  return (url: string) => {
    const parsed = parseUrl(url);
    if (!parsed) return "";
    if (!options.hosts.includes(normalizedHost(parsed))) return "";
    const raw = pathHandle(parsed);
    return options.stripAt ? raw.replace(/^@/, "") : raw;
  };
}

const INSTAGRAM_HOSTS = ["instagram.com"] as const;
const FACEBOOK_HOSTS = ["facebook.com", "fb.com", "fb.watch"] as const;
const TIKTOK_HOSTS = ["tiktok.com", "vm.tiktok.com"] as const;
const YOUTUBE_HOSTS = ["youtube.com", "youtu.be", "m.youtube.com"] as const;
const SPOTIFY_HOSTS = ["open.spotify.com", "spotify.com"] as const;
const SOUNDCLOUD_HOSTS = ["soundcloud.com", "snd.sc"] as const;

export const SOCIAL_PLATFORMS: readonly SocialPlatform[] = [
  {
    id: "instagram",
    name: "Instagram",
    iconSrc: "/socials/instagram.png",
    pillTitle: "instagram-pill",
    hosts: INSTAGRAM_HOSTS,
    supportsHandleInput: true,
    inputPlaceholder: "atmos or https://instagram.com/atmos",
    inputHelp:
      "Letters, numbers, dots, and underscores. Leading @ is optional.",
    pillClassName:
      "border-pink-400/40 bg-pink-500/10 text-pink-100 hover:border-pink-300/70 hover:bg-pink-500/20 hover:text-white",
    normalizeInput: makeHandleNormalizer({
      baseUrl: "https://instagram.com",
      handlePattern: /^[a-zA-Z0-9._]+$/,
      hosts: INSTAGRAM_HOSTS,
    }),
    extractHandle: makeHandleExtractor({ hosts: INSTAGRAM_HOSTS }),
  },
  {
    id: "facebook",
    name: "Facebook",
    iconSrc: "/socials/facebook.png",
    pillTitle: "facebook-pill",
    hosts: FACEBOOK_HOSTS,
    supportsHandleInput: true,
    inputPlaceholder: "atmos.collective or https://facebook.com/atmos",
    inputHelp:
      "Letters, numbers, dots, and hyphens. Leading @ is optional.",
    pillClassName:
      "border-blue-400/40 bg-blue-500/10 text-blue-100 hover:border-blue-300/70 hover:bg-blue-500/20 hover:text-white",
    normalizeInput: makeHandleNormalizer({
      baseUrl: "https://facebook.com",
      handlePattern: /^[a-zA-Z0-9.\-]+$/,
      hosts: FACEBOOK_HOSTS,
    }),
    extractHandle: makeHandleExtractor({ hosts: FACEBOOK_HOSTS }),
  },
  {
    id: "tiktok",
    name: "TikTok",
    iconSrc: "/socials/tiktok.png",
    pillTitle: "tiktok-pill",
    hosts: TIKTOK_HOSTS,
    supportsHandleInput: true,
    inputPlaceholder: "atmos or https://tiktok.com/@atmos",
    inputHelp:
      "Letters, numbers, dots, and underscores. Leading @ is optional.",
    pillClassName:
      "border-zinc-400/40 bg-zinc-900/40 text-zinc-100 hover:border-zinc-300/70 hover:bg-zinc-800/60 hover:text-white",
    normalizeInput: makeHandleNormalizer({
      baseUrl: "https://tiktok.com",
      handlePattern: /^[a-zA-Z0-9._]+$/,
      hosts: TIKTOK_HOSTS,
      atPrefix: true,
    }),
    extractHandle: makeHandleExtractor({
      hosts: TIKTOK_HOSTS,
      stripAt: true,
    }),
  },
  {
    id: "youtube",
    name: "YouTube",
    iconSrc: "/socials/youtube.png",
    pillTitle: "youtube-pill",
    hosts: YOUTUBE_HOSTS,
    supportsHandleInput: true,
    inputPlaceholder: "atmos or https://youtube.com/@atmos",
    inputHelp:
      "Channel handle (e.g. atmos) or a full YouTube URL. Leading @ is optional.",
    pillClassName:
      "border-red-400/40 bg-red-500/10 text-red-100 hover:border-red-300/70 hover:bg-red-500/20 hover:text-white",
    normalizeInput: (input) => {
      const trimmed = input.trim();
      if (!trimmed) return null;
      const parsed = parseUrl(trimmed);
      if (parsed) {
        if (!YOUTUBE_HOSTS.includes(normalizedHost(parsed) as (typeof YOUTUBE_HOSTS)[number])) return null;
        return parsed.toString();
      }
      const handle = trimmed.replace(/^@/, "").replace(/\/+$/, "");
      if (!/^[a-zA-Z0-9._\-]+$/.test(handle)) return null;
      return `https://youtube.com/@${handle}`;
    },
    extractHandle: makeHandleExtractor({
      hosts: YOUTUBE_HOSTS,
      stripAt: true,
    }),
  },
  {
    id: "spotify",
    name: "Spotify",
    iconSrc: "/socials/spotify.png",
    pillTitle: "spotify-pill",
    hosts: SPOTIFY_HOSTS,
    supportsHandleInput: false,
    inputPlaceholder: "https://open.spotify.com/artist/...",
    inputHelp: "Paste a Spotify artist, album, track, or playlist URL.",
    pillClassName:
      "border-emerald-400/40 bg-emerald-500/10 text-emerald-100 hover:border-emerald-300/70 hover:bg-emerald-500/20 hover:text-white",
    normalizeInput: urlOnlyNormalizer(SPOTIFY_HOSTS),
    extractHandle: () => "",
  },
  {
    id: "soundcloud",
    name: "SoundCloud",
    iconSrc: "/socials/soundcloud_color.png",
    pillTitle: "soundcloud-pill",
    hosts: SOUNDCLOUD_HOSTS,
    supportsHandleInput: true,
    inputPlaceholder: "atmos or https://soundcloud.com/atmos",
    inputHelp:
      "Letters, numbers, dashes, and underscores. Leading @ is optional.",
    pillClassName:
      "border-orange-400/40 bg-orange-500/10 text-orange-100 hover:border-orange-300/70 hover:bg-orange-500/20 hover:text-white",
    normalizeInput: makeHandleNormalizer({
      baseUrl: "https://soundcloud.com",
      handlePattern: /^[a-zA-Z0-9_\-]+$/,
      hosts: SOUNDCLOUD_HOSTS,
    }),
    extractHandle: makeHandleExtractor({ hosts: SOUNDCLOUD_HOSTS }),
  },
] as const;

const PLATFORM_BY_ID = new Map<SocialPlatformId, SocialPlatform>(
  SOCIAL_PLATFORMS.map((p) => [p.id, p]),
);

const PLATFORM_BY_PILL_TITLE = new Map<string, SocialPlatform>(
  SOCIAL_PLATFORMS.map((p) => [p.pillTitle, p]),
);

export function getPlatform(id: SocialPlatformId): SocialPlatform {
  const platform = PLATFORM_BY_ID.get(id);
  if (!platform) {
    throw new Error(`Unknown social platform: ${id}`);
  }
  return platform;
}

export function detectPlatformFromUrl(url: string): SocialPlatform | null {
  const parsed = parseUrl(url);
  if (!parsed) return null;
  const host = normalizedHost(parsed);
  for (const platform of SOCIAL_PLATFORMS) {
    if ((platform.hosts as readonly string[]).includes(host)) return platform;
  }
  return null;
}

export function getPlatformFromPillTitle(
  title: string | null | undefined,
): SocialPlatform | null {
  if (!title) return null;
  return PLATFORM_BY_PILL_TITLE.get(title) ?? null;
}

/**
 * Given a pill URL and an optional existing pill title, return the platform
 * that should own the pill. Prefers the URL's platform so that editing a
 * link's URL implicitly updates its icon/style.
 */
export function resolvePillPlatform(
  url: string,
  existingTitle?: string | null,
): SocialPlatform | null {
  return (
    detectPlatformFromUrl(url) ?? getPlatformFromPillTitle(existingTitle ?? null)
  );
}
