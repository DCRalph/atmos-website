import "server-only";

import { env } from "~/env";

/**
 * Reading a post off Instagram.
 *
 * Instagram will only hand over a caption and media for accounts the token
 * owns. That is the whole shape of this module: it fetches from `me/media` and
 * looks for the shortcode in the URL. A venue's or a promoter's post is not
 * reachable at any price, so the failure is a specific one the wizard can turn
 * into "paste the caption instead" rather than a generic error.
 */

const GRAPH_BASE = "https://graph.instagram.com/v21.0";

/** Fields worth asking for. `children` covers carousels. */
const MEDIA_FIELDS =
  "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username,children{media_type,media_url,thumbnail_url}";

/** How many recent posts to look through before giving up. */
const MAX_PAGES = 4;
const PAGE_SIZE = 50;

export type InstagramImage = {
  url: string;
  /** Position in the carousel. 0 is the one Instagram shows first. */
  index: number;
};

/** A post as fetched. Stored verbatim on the `GigImport` row. */
export type InstagramPost = {
  shortcode: string;
  permalink: string;
  username: string | null;
  caption: string;
  /** When it was posted, which is what an undated "Friday" is relative to. */
  postedAt: string;
  images: InstagramImage[];
};

/**
 * Who the token belongs to, or null if there is no working token.
 *
 * The wizard shows this on step one. Only this account's posts can ever be
 * read, and that is not obvious from the outside, so naming it is the
 * difference between a URL failing for an understandable reason and failing
 * mysteriously. It doubles as a liveness check: a token that has passed its
 * sixty days returns null here rather than looking connected until used.
 */
export async function fetchConnectedAccount(): Promise<{
  username: string;
} | null> {
  const token = env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) return null;

  try {
    const response = await fetch(
      `${GRAPH_BASE}/me?fields=username&access_token=${encodeURIComponent(token)}`,
      { cache: "no-store", signal: AbortSignal.timeout(10_000) },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as { username?: string };
    return body.username ? { username: body.username } : null;
  } catch {
    return null;
  }
}

export class InstagramUnavailableError extends Error {
  constructor(
    message: string,
    /** True when pasting the caption by hand is the way forward. */
    readonly canPasteInstead: boolean,
  ) {
    super(message);
    this.name = "InstagramUnavailableError";
  }
}

/**
 * The shortcode in a post, reel or share URL.
 *
 * Instagram hands out several shapes of link and they all carry the same code
 * in the same place, so this matches on the segment rather than the host.
 */
export function instagramShortcode(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)instagram\.com$/.test(parsed.hostname)) return null;

  const segments = parsed.pathname.split("/").filter(Boolean);
  const kindAt = segments.findIndex((segment) =>
    ["p", "reel", "reels", "tv"].includes(segment),
  );
  if (kindAt === -1) return null;

  const code = segments[kindAt + 1];
  return code && /^[A-Za-z0-9_-]+$/.test(code) ? code : null;
}

type GraphChild = {
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
};

type GraphMedia = {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  username?: string;
  children?: { data?: GraphChild[] };
};

type GraphPage = {
  data?: GraphMedia[];
  paging?: { next?: string };
  error?: { message?: string };
};

/** A video's poster frame is the useful image; a photo's is itself. */
const imageUrlOf = (media: GraphChild): string | null =>
  media.media_type === "VIDEO"
    ? (media.thumbnail_url ?? null)
    : (media.media_url ?? media.thumbnail_url ?? null);

function toPost(media: GraphMedia): InstagramPost {
  const children = media.children?.data ?? [];
  const sources = children.length > 0 ? children : [media];

  return {
    shortcode: instagramShortcode(media.permalink ?? "") ?? media.id,
    permalink: media.permalink ?? "",
    username: media.username ?? null,
    caption: media.caption ?? "",
    postedAt: media.timestamp ?? new Date().toISOString(),
    images: sources
      .map(imageUrlOf)
      .filter((url): url is string => Boolean(url))
      .map((url, index) => ({ url, index })),
  };
}

/**
 * Find a post of ours by its URL.
 *
 * There is no "get by shortcode" endpoint, so this walks recent media. Four
 * pages is far more than the wizard ever needs — nobody imports a gig from a
 * post two hundred deep — and it bounds the call.
 */
export async function fetchInstagramPost(url: string): Promise<InstagramPost> {
  const shortcode = instagramShortcode(url);
  if (!shortcode) {
    throw new InstagramUnavailableError(
      "That does not look like an Instagram post or reel link.",
      false,
    );
  }

  const token = env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) {
    throw new InstagramUnavailableError(
      "Instagram is not connected, so posts cannot be read automatically.",
      true,
    );
  }

  let next = `${GRAPH_BASE}/me/media?fields=${MEDIA_FIELDS}&limit=${PAGE_SIZE}&access_token=${encodeURIComponent(token)}`;

  for (let page = 0; page < MAX_PAGES && next; page++) {
    const response = await fetch(next, { cache: "no-store" });
    const body = (await response.json()) as GraphPage;

    if (!response.ok || body.error) {
      throw new InstagramUnavailableError(
        body.error?.message ??
          `Instagram refused the request (${response.status}).`,
        true,
      );
    }

    const found = body.data?.find(
      (media) => instagramShortcode(media.permalink ?? "") === shortcode,
    );
    if (found) return toPost(found);

    next = body.paging?.next ?? "";
  }

  // Naming the account is the whole value of this message: the usual cause is
  // a post belonging to somebody else, and "not on the connected account" does
  // not say which account that is.
  const account = await fetchConnectedAccount();
  throw new InstagramUnavailableError(
    account
      ? `That post is not on @${account.username}, which is the connected account. Only its own posts can be read. Paste the caption instead.`
      : "That post is not on the connected account, so its caption cannot be read.",
    true,
  );
}

/** A pasted caption, in the same shape as a fetched one. */
export function manualPost(caption: string): InstagramPost {
  return {
    shortcode: "",
    permalink: "",
    username: null,
    caption,
    postedAt: new Date().toISOString(),
    images: [],
  };
}

/**
 * Pull an image down so it can become the poster and be shown to the model.
 *
 * Instagram's CDN URLs are signed and expire, which is the reason the bytes are
 * taken now rather than the URL being stored and fetched later.
 */
export async function fetchImageBytes(
  url: string,
  timeoutMs = 20_000,
): Promise<{ buffer: Buffer; contentType: string }> {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new InstagramUnavailableError(
      `The post's image could not be downloaded (${response.status}).`,
      false,
    );
  }
  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  if (!contentType.startsWith("image/")) {
    throw new InstagramUnavailableError(
      "The post's media is not an image.",
      false,
    );
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType,
  };
}
