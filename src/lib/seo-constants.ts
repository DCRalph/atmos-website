import { type Metadata } from "next";
import { env } from "~/env";

/* -------------------------------------------------------------------------- */
/*                                  Constants                                 */
/* -------------------------------------------------------------------------- */
export const SITE_NAME = "ATMOS";
export const SITE_TAGLINE = "Electronic music events";
export const SITE_NAME_FULL = `${SITE_NAME} electronic music events`;

export const SITE_URL = env.NEXT_PUBLIC_APP_URL ?? "https://atmosmedia.co.nz";

export const DESCRIPTION_SHORT = "Immersive curated music experiences";

export const DESCRIPTION_LONG =
  "Gig tickets, weekly radio show, merch drops, dive into the galleries from our past events. Everything Atmos - all in one place";

/** Formats a page title with the site name suffix for OG/Twitter (which don't use Next.js template) */
export const formatFullTitle = (title: string) => `${title} | ${SITE_NAME}`;

/*                                   Images                                   */

export const DEFAULT_OG_IMAGE = "/og-image-new.png";

export const OG_IMAGE = {
  url: DEFAULT_OG_IMAGE,
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} electronic music events`,
} as const;

/* -------------------------------------------------------------------------- */
/*                                   SEO                                      */
/* -------------------------------------------------------------------------- */

export const COMMON_KEYWORDS = [
  "electronic music events",
  "club nights",
  "dj events",
  "underground club nights",
  "electronic music promoter",
  "dance music collective",
] as const;

export const DEFAULT_ROBOTS: Metadata["robots"] = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-video-preview": -1,
    "max-image-preview": "large",
    "max-snippet": -1,
  },
};

/** Robots for pages reached only by a link somebody was sent. */
export const NOINDEX: Metadata["robots"] = { index: false, follow: false };

/**
 * Open Graph defaults with no title, description or URL. The root layout uses
 * these as is: Next merges `openGraph` shallowly, so anything page-specific set
 * here would turn up on every page that sets only its own `title`.
 */
export const DEFAULT_OPENGRAPH = {
  siteName: SITE_NAME,
  locale: "en_NZ",
  type: "website",
  images: [OG_IMAGE],
} satisfies Metadata["openGraph"];

export const DEFAULT_TWITTER = {
  card: "summary_large_image",
  images: [OG_IMAGE],
} satisfies Metadata["twitter"];

/* -------------------------------------------------------------------------- */
/*                               Misc metadata                                */
/* -------------------------------------------------------------------------- */

export const VERIFICATION = {
  google: "wqpr0iOn_-vf0MC-mGnQiWqbZcDjRXTfA5INdAbDbGk",
} as const;

export const ICONS: Metadata["icons"] = {
  icon: [
    { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    { url: "/favicon.ico", rel: "icon" },
  ],
  apple: "/apple-touch-icon.png",
  shortcut: "/favicon.ico",
};

/* -------------------------------------------------------------------------- */
/*                               Helper builders                               */
/* -------------------------------------------------------------------------- */

type PageMetadataOptions = {
  /** Short title; the root template adds "| ATMOS". `absolute` skips it. */
  title: string | { absolute: string };
  description: string;
  /** Path from the site root, e.g. "/about". Becomes canonical and og:url. */
  path: string;
  keywords?: readonly string[];
  /** Replaces the default OG image, e.g. a gig's poster. */
  image?: {
    url: string;
    width: number;
    height: number;
    alt: string;
    type?: string;
  };
  /** Keep the page out of search, e.g. an unlisted event. */
  noindex?: boolean;
};

/**
 * Complete metadata for a public page, exported from its server `page.tsx`.
 * Sets every tag a link preview reads, so none of them fall back to the root
 * layout's. OG/Twitter get the full title, since they skip the template.
 */
export function pageMetadata({
  title,
  description,
  path,
  keywords,
  image,
  noindex,
}: PageMetadataOptions): Metadata {
  const fullTitle =
    typeof title === "string" ? formatFullTitle(title) : title.absolute;
  const images = image ? [image] : DEFAULT_OPENGRAPH.images;

  return {
    title,
    description,
    keywords: keywords && [...keywords],
    alternates: { canonical: path },
    ...(noindex && { robots: NOINDEX }),
    openGraph: {
      ...DEFAULT_OPENGRAPH,
      title: fullTitle,
      description,
      url: path,
      images,
    },
    twitter: { ...DEFAULT_TWITTER, title: fullTitle, description, images },
  };
}

/**
 * Metadata for a page reached by a private link: a ticket, a pass, a sign-in
 * step. A plain title and description so a shared link previews as what it is
 * without showing anything personal, and kept out of search.
 */
export function unlistedPageMetadata(
  title: string,
  description = DESCRIPTION_SHORT,
): Metadata {
  const fullTitle = formatFullTitle(title);

  return {
    title,
    description,
    robots: NOINDEX,
    openGraph: { ...DEFAULT_OPENGRAPH, title: fullTitle, description },
    twitter: { ...DEFAULT_TWITTER, title: fullTitle, description },
  };
}
