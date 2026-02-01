import { type Metadata } from "next";

/* -------------------------------------------------------------------------- */
/*                                  Constants                                 */
/* -------------------------------------------------------------------------- */

export const SITE_NAME = "ATMOS";
export const SITE_TAGLINE = "Wellington Electronic Music Events";
export const SITE_NAME_FULL = `${SITE_NAME} — ${SITE_TAGLINE}`;

export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://atmosmedia.co.nz";

export const DESCRIPTION_SHORT =
  "Wellington's curated electronic music events & club nights";

export const DESCRIPTION_LONG =
  "ATMOS — Wellington's home for curated electronic music events. Discover underground club nights, DJ events, and immersive nightlife experiences in Pōneke.";

/** Formats a page title with the site name suffix for OG/Twitter (which don't use Next.js template) */
export const formatFullTitle = (title: string) => `${title} | ${SITE_NAME}`;

/*                                   Images                                   */

export const DEFAULT_OG_IMAGE = "/og-image.png";

export const OG_IMAGE = {
  url: DEFAULT_OG_IMAGE,
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} — ${SITE_TAGLINE} & Club Nights`,
} as const;

/* -------------------------------------------------------------------------- */
/*                                   SEO                                      */
/* -------------------------------------------------------------------------- */

export const COMMON_KEYWORDS = [
  "wellington electronic music events",
  "wellington club nights",
  "wellington dj events",
  "pōneke nightlife",
  "underground club night wellington",
  "nz electronic music events",
  "electronic music promoter wellington",
  "dance music collective wellington",
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

export const DEFAULT_OPENGRAPH: Metadata["openGraph"] = {
  siteName: SITE_NAME,
  locale: "en_NZ",
  type: "website",
  images: [OG_IMAGE],
};

export const DEFAULT_TWITTER: Metadata["twitter"] = {
  card: "summary_large_image",
  images: [DEFAULT_OG_IMAGE],
};

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

/**
 * Creates metadata for a page.
 * - `title` is the SHORT title (Next.js template adds "| ATMOS")
 * - OpenGraph/Twitter get the FULL title (they don't use the template)
 */
function basePage(options: {
  title: string;
  ogTitle?: string; // Override for OG/Twitter if different from page title
  description?: string;
  keywords?: readonly string[];
}): Metadata {
  const description = options.description ?? DESCRIPTION_LONG;
  const fullTitle = options.ogTitle ?? formatFullTitle(options.title);

  return {
    title: options.title,
    description,
    keywords: options.keywords ? (options.keywords as string[]) : undefined,
    openGraph: {
      ...DEFAULT_OPENGRAPH,
      title: fullTitle,
      description,
    },
    twitter: {
      ...DEFAULT_TWITTER,
      title: fullTitle,
      description,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                              Page definitions                               */
/* -------------------------------------------------------------------------- */

export const PAGE_METADATA = {
  // Homepage uses absolute title (no template suffix)
  home: {
    title: { absolute: SITE_NAME_FULL },
    description:
      "Discover Wellington's best electronic music events. Curated club nights, underground DJ sets & immersive nightlife in Pōneke.",
    keywords: COMMON_KEYWORDS as unknown as string[],
    openGraph: {
      ...DEFAULT_OPENGRAPH,
      title: SITE_NAME_FULL,
      description:
        "Discover Wellington's best electronic music events. Curated club nights, underground DJ sets & immersive nightlife in Pōneke.",
    },
    twitter: {
      ...DEFAULT_TWITTER,
      title: SITE_NAME_FULL,
      description:
        "Discover Wellington's best electronic music events. Curated club nights, underground DJ sets & immersive nightlife in Pōneke.",
    },
  },

  gigs: basePage({
    title: "Events",
    ogTitle: "Wellington DJ Events & Club Nights | ATMOS",
    description:
      "Discover upcoming electronic music events in Wellington. Browse curated club nights, DJ sets, and immersive nightlife experiences.",
    keywords: [
      "wellington dj events",
      "wellington club nights",
      "wellington nightlife events",
      "techno night wellington",
      "house music night wellington",
      "things to do in wellington at night",
      "wellington gig guide electronic",
      "pōneke nightlife events",
    ],
  }),

  about: basePage({
    title: "About",
    ogTitle: "About ATMOS — Wellington Electronic Music Collective",
    description:
      "ATMOS is Wellington's electronic music promoter & collective. We curate underground club nights and immersive DJ events in Pōneke.",
  }),

  crew: basePage({
    title: "Crew",
    ogTitle: "Wellington DJs & Artists | ATMOS",
    description:
      "Meet the ATMOS crew — Wellington's finest DJs, producers, and electronic music artists from the Pōneke underground scene.",
  }),

  contact: basePage({ title: "Contact" }),
  terms: basePage({ title: "Terms" }),
  privacy: basePage({ title: "Privacy" }),
  socials: basePage({ title: "Socials" }),
  merch: basePage({ title: "Merch" }),
  content: basePage({ title: "Content" }),
} satisfies Record<string, Metadata>;

/* -------------------------------------------------------------------------- */
/*                           Metadata factory functions                         */
/* -------------------------------------------------------------------------- */

export function createPageMetadata(
  page: keyof typeof PAGE_METADATA,
  overrides?: Partial<Metadata>,
): Metadata {
  return {
    ...PAGE_METADATA[page],
    robots: DEFAULT_ROBOTS,
    ...overrides,
  };
}

/**
 * Creates metadata for individual gig/event pages.
 * Format: "<gig name> | Gig | ATMOS"
 */
export function createGigMetadata(
  title: string,
  description: string,
  image?: string | null,
  canonical?: string,
): Metadata {
  const fullTitle = `${title} | Gig | ${SITE_NAME}`;

  return {
    title: { absolute: fullTitle }, // Full title, bypasses template
    description,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      ...DEFAULT_OPENGRAPH,
      title: fullTitle,
      description,
      url: canonical,
      images: image ? [image] : undefined,
      type: "article",
    },
    twitter: {
      ...DEFAULT_TWITTER,
      title: fullTitle,
      description,
      images: image ? [image] : undefined,
    },
    robots: DEFAULT_ROBOTS,
  };
}