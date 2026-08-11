/**
 * Deterministic fixture data for the creator UI test harness.
 *
 * Everything here is frozen — fixed ids, fixed dates, fixed text — so two runs
 * of the screenshot audit produce byte-identical layouts. Nothing in this file
 * touches the database or `Date.now()`.
 */
import {
  BLOCK_TYPES,
  findFreeSlot,
  type ClientBlock,
  type CreatorBlockTypeName,
} from "~/components/creator/block-types";
import type {
  PublicGigAttribution,
  PublicSocial,
} from "~/components/creator/block-renderer";
import {
  DEFAULT_THEME_TOKENS,
  LIGHT_THEME_TOKENS,
  type ThemeTokens,
} from "~/lib/creator-theme";

export const FIXTURE_COLS = 12;
export const FIXTURE_ROW_HEIGHT = 60;

/**
 * Fake `file_upload` ids. They resolve to `/api/media/<id>`, which 404s — the
 * audit script intercepts the request and serves a placeholder so screenshots
 * are offline and stable. When browsing the harness by hand these render as
 * broken images; that is expected and does not move the layout, because every
 * image in these blocks is either `fill` (absolutely positioned) or has an
 * explicit box.
 */
const IMG = (n: number) => `uitest-image-${n}`;

export const FIXTURE_SOCIALS: PublicSocial[] = [
  {
    platform: "instagram",
    url: "https://instagram.com/atmosmedia",
    label: null,
  },
  {
    platform: "soundcloud",
    url: "https://soundcloud.com/atmosmedia",
    label: null,
  },
  {
    platform: "spotify",
    url: "https://open.spotify.com/artist/1234567890",
    label: null,
  },
  { platform: "youtube", url: "https://youtube.com/@atmosmedia", label: null },
  { platform: "tiktok", url: "https://tiktok.com/@atmosmedia", label: null },
  { platform: "facebook", url: "https://facebook.com/atmosmedia", label: null },
  { platform: "", url: "https://atmosmedia.co.nz", label: "Website" },
];

function gig(
  n: number,
  title: string,
  subtitle: string | null,
  isoDate: string,
  role: string | null,
  withPoster: boolean,
  mode = "PUBLISHED",
): PublicGigAttribution {
  return {
    id: `uitest-attr-${n}`,
    role,
    gig: {
      id: `uitest-gig-${n}`,
      title,
      subtitle,
      gigStartTime: new Date(isoDate),
      gigEndTime: null,
      posterFileUploadId: withPoster ? IMG(100 + n) : null,
      mode,
    },
  };
}

export const FIXTURE_GIGS: PublicGigAttribution[] = [
  gig(
    1,
    "Basement Sessions Vol. 9",
    "Late night warehouse",
    "2025-11-14T09:00:00.000Z",
    "Headline DJ",
    true,
  ),
  gig(
    2,
    "Winterfest",
    "Main stage",
    "2025-08-02T06:00:00.000Z",
    "Support",
    true,
  ),
  gig(
    3,
    "Rooftop Opening Party",
    null,
    "2025-04-19T07:00:00.000Z",
    "Resident",
    true,
  ),
  gig(
    4,
    "A Very Long Gig Title That Should Wrap Onto Two Lines And Then Clamp",
    "With a subtitle that is also fairly long",
    "2024-12-31T08:00:00.000Z",
    "B2B",
    false,
  ),
  gig(
    5,
    "Secret Show",
    null,
    "2024-09-07T07:00:00.000Z",
    null,
    false,
    "TO_BE_ANNOUNCED",
  ),
  gig(
    6,
    "Harbourside Sunset",
    "Sunset set",
    "2024-06-15T05:00:00.000Z",
    "Opener",
    true,
  ),
];

/** A small serialized Lexical state — a heading-free bio with two paragraphs. */
const LEXICAL_BIO = {
  root: {
    children: [
      paragraph(
        "Producer and selector working somewhere between broken beat and dub. Resident at Basement Sessions, occasional radio host.",
      ),
      paragraph(
        "Available for club shows, festivals and the odd wedding if the sound system is good enough.",
      ),
    ],
    direction: "ltr",
    format: "",
    indent: 0,
    type: "root",
    version: 1,
  },
};

function paragraph(text: string) {
  return {
    children: [
      {
        detail: 0,
        format: 0,
        mode: "normal",
        style: "",
        text,
        type: "text",
        version: 1,
      },
    ],
    direction: "ltr",
    format: "",
    indent: 0,
    type: "paragraph",
    version: 1,
    textFormat: 0,
    textStyle: "",
  };
}

/** Realistic, fully-populated data for each block type. */
const POPULATED_DATA: Record<CreatorBlockTypeName, Record<string, unknown>> = {
  HEADING: { text: "Listen", level: 2, align: "left" },
  RICH_TEXT: { lexical: LEXICAL_BIO },
  IMAGE: { fileId: IMG(1), alt: "Press shot" },
  GALLERY: { fileIds: [IMG(2), IMG(3), IMG(4), IMG(5), IMG(6), IMG(7)] },
  SOUNDCLOUD_TRACK: { url: "https://soundcloud.com/atmosmedia/example-track" },
  SOUNDCLOUD_PLAYLIST: {
    url: "https://soundcloud.com/atmosmedia/sets/example-set",
  },
  YOUTUBE_VIDEO: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  SPOTIFY_EMBED: { url: "https://open.spotify.com/album/1234567890abcdef" },
  SOCIAL_LINKS: {},
  LINK_LIST: {
    links: [
      { label: "Bookings", url: "https://example.com/bookings" },
      { label: "Press kit", url: "https://example.com/press" },
      { label: "Merch", url: "https://example.com/merch" },
      { label: "Newsletter", url: "https://example.com/newsletter" },
    ],
  },
  GIG_LIST: { source: "auto", gigIds: [] },
  PAST_GIGS: { title: "Past gigs", includeUpcoming: false, showRole: true },
  CONTENT_LIST: { contentIds: [] },
  DIVIDER: {},
  SPACER: {},
  CUSTOM_EMBED: { url: "https://example.com/embed" },
};

export const ALL_BLOCK_TYPES: CreatorBlockTypeName[] = BLOCK_TYPES.map(
  (b) => b.type,
);

type BuildOptions = {
  /** `"populated"` uses realistic data, `"empty"` uses each type's `defaultData`. */
  data?: "populated" | "empty";
  /** Force every block to this height in rows (default: the type's `defaultH`). */
  forceH?: number;
  /** Force every block to this width in cols (default: the type's `defaultW`). */
  forceW?: number;
  types?: CreatorBlockTypeName[];
  cols?: number;
};

/**
 * Lay blocks out exactly the way the editor does when you click "Add block"
 * repeatedly — same default sizes, same `findFreeSlot` packing. This is the
 * layout most profiles actually end up with, so it is the one worth testing.
 */
export function buildBlocks(options: BuildOptions = {}): ClientBlock[] {
  const {
    data = "populated",
    forceH,
    forceW,
    types = ALL_BLOCK_TYPES,
    cols = FIXTURE_COLS,
  } = options;

  const placed: ClientBlock[] = [];
  for (const type of types) {
    const def = BLOCK_TYPES.find((b) => b.type === type);
    if (!def) continue;
    const w = Math.min(cols, forceW ?? def.defaultW);
    const h = forceH ?? def.defaultH;
    const pos = findFreeSlot(placed, cols, w, h);
    placed.push({
      id: `uitest-${type.toLowerCase()}-${w}x${h}`,
      type,
      x: pos.x,
      y: pos.y,
      w,
      h,
      data:
        data === "populated"
          ? { ...POPULATED_DATA[type] }
          : { ...def.defaultData },
    });
  }
  return placed;
}

// ---------------------------------------------------------------------------
// Theme variants
// ---------------------------------------------------------------------------

export const THEME_VARIANTS: Array<{
  id: string;
  label: string;
  tokens: ThemeTokens;
}> = [
  { id: "dark", label: "Default (dark)", tokens: DEFAULT_THEME_TOKENS },
  { id: "light", label: "Light", tokens: LIGHT_THEME_TOKENS },
  {
    id: "compact",
    label: "Compact density, tight padding",
    tokens: {
      ...DEFAULT_THEME_TOKENS,
      density: "compact",
      blockPaddingX: 4,
      blockPaddingY: 4,
      blockRadius: 4,
    },
  },
  {
    id: "spacious",
    label: "Spacious density, chunky padding",
    tokens: {
      ...DEFAULT_THEME_TOKENS,
      density: "spacious",
      blockPaddingX: 32,
      blockPaddingY: 32,
      blockRadius: 24,
      blockBorderWidth: 3,
      blockShadow: "lg",
    },
  },
];

// ---------------------------------------------------------------------------
// Profile identity fixtures (for the hero / final page)
// ---------------------------------------------------------------------------

export const HERO_VARIANTS = [
  {
    id: "full",
    label: "Banner + avatar + tagline",
    displayName: "Nova Kestrel",
    handle: "novakestrel",
    tagline: "Broken beat, dub pressure, and the occasional ballad.",
    avatarFileId: IMG(200),
    bannerFileId: IMG(201),
    claimStatus: "CLAIMED",
  },
  {
    id: "no-banner",
    label: "No banner (accent gradient fallback)",
    displayName: "Nova Kestrel",
    handle: "novakestrel",
    tagline: "Broken beat, dub pressure, and the occasional ballad.",
    avatarFileId: IMG(200),
    bannerFileId: null,
    claimStatus: "CLAIMED",
  },
  {
    id: "bare",
    label: "No banner, no avatar, no tagline, unclaimed",
    displayName: "Someone With A Genuinely Very Long Display Name Indeed",
    handle: "someone-with-a-genuinely-very-long-handle",
    tagline: null,
    avatarFileId: null,
    bannerFileId: null,
    claimStatus: "UNCLAIMED",
  },
] as const;

export const FIXTURE_BIO =
  "Nova has been playing records since a friend left a pair of belt-drives in their flat in 2016. Since then: three EPs, a residency, and one very memorable set played entirely on a broken monitor.";
