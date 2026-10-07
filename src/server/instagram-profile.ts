import "server-only";

import { z } from "zod";

import { getPlatform } from "~/lib/social-pills";
import { readHtml } from "~/lib/web-page";
import { publicFetch, WebFetchError } from "~/server/web";

/**
 * Someone else's public Instagram profile: their name, bio and profile photo,
 * for setting up a creator profile from a pasted link.
 *
 * The Graph API only reaches other accounts through Facebook Login, which the
 * site does not use (see `~/server/gig-import/instagram`), so this reads what
 * Instagram serves logged-out visitors. Two ways, best first:
 *
 * 1. The profile endpoint the Instagram app calls. Full details and a 320px
 *    photo, but Instagram rate limits it, harder from datacenter addresses.
 * 2. The profile page's link preview tags, which Instagram serves to link
 *    crawlers. Name and a 100px photo only.
 *
 * Photo URLs are signed and expire within days, so they are for downloading
 * now, not for storing.
 */

export type InstagramProfile = {
  username: string;
  name: string | null;
  biography: string | null;
  /** The link in their bio. */
  website: string | null;
  url: string;
  photoUrl: string | null;
  /** 320 from the profile endpoint, 100 from the page. */
  photoSize: number | null;
  isPrivate: boolean | null;
  followers: number | null;
};

/** Path segments that are Instagram pages, not usernames. */
const NOT_USERNAMES = new Set([
  "p",
  "reel",
  "reels",
  "tv",
  "explore",
  "accounts",
]);

/** The username in a handle, an @handle, or a profile or story link. */
export function instagramUsername(input: string): string | null {
  const instagram = getPlatform("instagram");
  const url = instagram.normalizeInput(
    input
      .trim()
      .replace(/[?#].*$/, "")
      .replace(/^(?=(www\.)?instagram\.com\/)/i, "https://"),
  );
  if (!url) return null;
  const segments = new URL(url).pathname.split("/").filter(Boolean);
  const username = segments[0] === "stories" ? segments[1] : segments[0];
  if (!username || NOT_USERNAMES.has(username)) return null;
  return /^[a-zA-Z0-9._]{1,30}$/.test(username) ? username.toLowerCase() : null;
}

/** Instagram sends an empty string for a field left blank. */
const optionalText = z
  .string()
  .nullish()
  .transform((text) => text || null); // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing -- an empty string should become null too

const appResponseSchema = z.object({
  data: z.object({
    user: z
      .object({
        username: z.string(),
        full_name: optionalText,
        biography: optionalText,
        external_url: optionalText,
        is_private: z.boolean().nullish(),
        profile_pic_url_hd: z.string().nullish(),
        profile_pic_url: z.string().nullish(),
        edge_followed_by: z.object({ count: z.number() }).nullish(),
      })
      .nullable(),
  }),
});

async function fromAppEndpoint(
  username: string,
): Promise<InstagramProfile | "not-found" | null> {
  const response = await publicFetch(
    `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
    // The endpoint answers the app, and refuses a browser.
    { headers: { "User-Agent": "Instagram 219.0.0.12.117 Android" } },
  );
  if (response.status === 404) return "not-found";
  if (!response.ok) return null;
  const parsed = appResponseSchema.safeParse(await response.json());
  if (!parsed.success) return null;
  const user = parsed.data.data.user;
  if (!user) return "not-found";
  return {
    username: user.username,
    name: user.full_name,
    biography: user.biography,
    website: user.external_url,
    url: `https://instagram.com/${user.username}`,
    photoUrl: user.profile_pic_url_hd ?? user.profile_pic_url ?? null,
    photoSize: 320,
    isPrivate: user.is_private ?? null,
    followers: user.edge_followed_by?.count ?? null,
  };
}

async function fromProfilePage(
  username: string,
): Promise<InstagramProfile | "not-found" | null> {
  const url = `https://www.instagram.com/${username}/`;
  const response = await publicFetch(url, {
    headers: { "User-Agent": "facebookexternalhit/1.1" },
  });
  if (response.status === 404) return "not-found";
  if (!response.ok) return null;
  const page = readHtml(await response.text(), url);
  // A missing account still answers 200, with the generic Instagram title.
  if (!page.title?.includes(`@${username}`)) return null;

  // "Name (@handle) • Instagram photos and videos"
  const name = /^(.*?)\s*\(@/.exec(page.title)?.[1] ?? null;
  // "1,234 Followers, 56 Following, 78 Posts - See Instagram photos…"
  const followers = /^([\d.,]+[KMB]?) Followers/i.exec(page.description ?? "");
  return {
    username,
    name: name || null, // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing -- an empty string should become null too
    biography: null,
    website: null,
    url: `https://instagram.com/${username}`,
    photoUrl: page.image,
    photoSize: page.image ? 100 : null,
    isPrivate: null,
    followers: followers?.[1] ? parseCount(followers[1]) : null,
  };
}

const SCALE: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9 };

/** "1,234" or "12.5K" as a number. */
function parseCount(text: string): number | null {
  const match = /^([\d.,]+)([KMB]?)$/i.exec(text);
  if (!match?.[1]) return null;
  const scale = SCALE[(match[2] ?? "").toUpperCase()] ?? 1;
  return Math.round(Number(match[1].replaceAll(",", "")) * scale);
}

export async function fetchInstagramProfile(
  username: string,
): Promise<InstagramProfile> {
  for (const read of [fromAppEndpoint, fromProfilePage]) {
    const profile = await read(username).catch((error: unknown) => {
      if (error instanceof WebFetchError) return null;
      throw error;
    });
    if (profile === "not-found") {
      throw new WebFetchError(`There is no Instagram account @${username}.`);
    }
    if (profile) return profile;
  }
  throw new WebFetchError(
    `Instagram would not show @${username}'s profile. It rate limits logged-out reads; try again in a few minutes, or upload the photo by hand.`,
  );
}
