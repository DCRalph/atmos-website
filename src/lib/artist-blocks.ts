import { GRID } from "./artist-grid";

/** Mirrors the `ArtistBlockType` enum. */
export type ArtistBlockTypeName =
  | "HEADING"
  | "RICH_TEXT"
  | "IMAGE"
  | "GALLERY"
  | "SOUNDCLOUD_TRACK"
  | "SOUNDCLOUD_PLAYLIST"
  | "YOUTUBE_VIDEO"
  | "SPOTIFY_EMBED"
  | "RELEASE"
  | "SOCIAL_LINKS"
  | "LINK_LIST"
  | "GIG_LIST"
  | "PAST_GIGS"
  | "CONTENT_LIST"
  | "DIVIDER"
  | "SPACER"
  | "CUSTOM_EMBED";

/**
 * A block as the editor holds it: one `ArtistBlock` row. `x`, `y`, `w`, `h`
 * are grid units (see `~/lib/artist-grid`).
 */
export type ClientBlock = {
  id: string;
  /** Not saved yet: the server creates it and answers with its real id. */
  isNew?: boolean;
  type: ArtistBlockTypeName;
  x: number;
  y: number;
  w: number;
  h: number;
  data: Record<string, unknown>;
};

/**
 * How a block takes its height:
 *
 *  - `auto`: from its content (text, players with a set height, lists of
 *    sets). The editor measures it; only its width is the artist's.
 *  - `fill`: from the artist (photos, embeds, space). The content fills
 *    whatever box it's given.
 */
export type BlockSizing = "auto" | "fill";

export type BlockGroup =
  "Words" | "Music" | "Pictures" | "Atmos" | "Links" | "Layout";

export type BlockTypeDefinition = {
  type: ArtistBlockTypeName;
  label: string;
  description: string;
  group: BlockGroup;
  sizing: BlockSizing;
  /** Columns when added. */
  w: number;
  /** Narrowest it can go. */
  minW: number;
  /** Rows when added, for `fill` blocks. Auto blocks are measured. */
  h: number;
  /** Shortest a `fill` block can go. */
  minH: number;
  defaultData: Record<string, unknown>;
};

const def = (
  d: Omit<BlockTypeDefinition, "h" | "minH" | "minW"> &
    Partial<Pick<BlockTypeDefinition, "h" | "minH" | "minW">>,
): BlockTypeDefinition => ({ h: 1, minH: 1, minW: 2, ...d });

// CONTENT_LIST stays in the type union (the DB enum has it) but is not offered
// or rendered anywhere until the block actually exists.
export const BLOCK_TYPES = [
  def({
    type: "HEADING",
    label: "Heading",
    description: "A big title in your display font",
    group: "Words",
    sizing: "auto",
    w: GRID.cols,
    defaultData: { text: "", level: 2, align: "left" },
  }),
  def({
    type: "RICH_TEXT",
    label: "Text",
    description: "Paragraphs, lists and links",
    group: "Words",
    sizing: "auto",
    w: 6,
    minW: 3,
    defaultData: {},
  }),
  def({
    type: "SOUNDCLOUD_TRACK",
    label: "SoundCloud track",
    description: "One track in a compact player",
    group: "Music",
    sizing: "auto",
    w: 6,
    minW: 3,
    defaultData: { url: "" },
  }),
  def({
    type: "SOUNDCLOUD_PLAYLIST",
    label: "SoundCloud playlist",
    description: "A set or playlist with artwork",
    group: "Music",
    sizing: "fill",
    w: 6,
    minW: 3,
    h: 11,
    minH: 7,
    defaultData: { url: "" },
  }),
  def({
    type: "SPOTIFY_EMBED",
    label: "Spotify",
    description: "A track, album or playlist",
    group: "Music",
    sizing: "auto",
    w: 6,
    minW: 3,
    defaultData: { url: "" },
  }),
  def({
    type: "RELEASE",
    label: "Release",
    description: "A record: cover, title and where to get it",
    group: "Music",
    sizing: "auto",
    w: 6,
    minW: 4,
    defaultData: {
      title: "",
      artist: "",
      coverFileId: null as string | null,
      links: [] as Array<{ label: string; url: string }>,
    },
  }),
  def({
    type: "IMAGE",
    label: "Photo",
    description: "One photo, cropped to the box",
    group: "Pictures",
    sizing: "fill",
    w: 6,
    h: 12,
    minH: 3,
    defaultData: { fileId: null as string | null, alt: "" },
  }),
  def({
    type: "GALLERY",
    label: "Photos",
    description: "A grid of photos that open full screen",
    group: "Pictures",
    sizing: "auto",
    w: GRID.cols,
    minW: 4,
    defaultData: { fileIds: [] as string[] },
  }),
  def({
    type: "YOUTUBE_VIDEO",
    label: "YouTube video",
    description: "One video",
    group: "Pictures",
    sizing: "auto",
    w: 8,
    minW: 3,
    defaultData: { url: "" },
  }),
  def({
    type: "GIG_LIST",
    label: "Upcoming sets",
    description: "Your next sets from Atmos lineups",
    group: "Atmos",
    sizing: "auto",
    w: GRID.cols,
    minW: 4,
    defaultData: { title: "Sets" },
  }),
  def({
    type: "PAST_GIGS",
    label: "Past sets",
    description: "Every set you've played on Atmos lineups",
    group: "Atmos",
    sizing: "auto",
    w: GRID.cols,
    minW: 4,
    defaultData: { title: "Past sets", includeUpcoming: false, showRole: true },
  }),
  def({
    type: "LINK_LIST",
    label: "Links",
    description: "Bookings, press kit, merch: big rows that link out",
    group: "Links",
    sizing: "auto",
    w: 6,
    minW: 3,
    defaultData: { links: [] as Array<{ label: string; url: string }> },
  }),
  def({
    type: "SOCIAL_LINKS",
    label: "Social links",
    description: "Your socials as big rows",
    group: "Links",
    sizing: "auto",
    w: 6,
    minW: 3,
    defaultData: {},
  }),
  def({
    type: "CUSTOM_EMBED",
    label: "Embed",
    description: "Any page that allows embedding",
    group: "Links",
    sizing: "fill",
    w: GRID.cols,
    minW: 3,
    h: 12,
    minH: 4,
    defaultData: { url: "" },
  }),
  def({
    type: "DIVIDER",
    label: "Divider",
    description: "A thin line",
    group: "Layout",
    sizing: "auto",
    w: GRID.cols,
    minW: 1,
    defaultData: {},
  }),
  def({
    type: "SPACER",
    label: "Space",
    description: "Room between blocks",
    group: "Layout",
    sizing: "fill",
    w: GRID.cols,
    minW: 1,
    h: 2,
    defaultData: {},
  }),
] as const satisfies readonly BlockTypeDefinition[];

/** Unknown and legacy types size as auto text, so they never reserve space. */
const FALLBACK: BlockTypeDefinition = def({
  type: "CONTENT_LIST",
  label: "Unsupported block",
  description: "This block can't be shown any more",
  group: "Layout",
  sizing: "auto",
  w: GRID.cols,
  defaultData: {},
});

export function getBlockDef(type: ArtistBlockTypeName): BlockTypeDefinition {
  return BLOCK_TYPES.find((b) => b.type === type) ?? FALLBACK;
}

/** An id for a block the server hasn't seen yet. */
export const tempId = () => `tmp_${Math.random().toString(36).slice(2, 10)}`;

/** A new block of `type`, not yet placed (see `appendBlock`). */
export function newBlock(type: ArtistBlockTypeName): ClientBlock {
  const d = getBlockDef(type);
  return {
    id: tempId(),
    isNew: true,
    type,
    x: 0,
    y: Number.MAX_SAFE_INTEGER,
    w: d.w,
    h: d.h,
    data: structuredClone(d.defaultData),
  };
}

/**
 * The small line at the top of a block's tile when the artist hasn't written
 * one (`data.label`). Null means no line. Headings and the sets blocks (which
 * have their own titles) aren't tiles' labels: see `ProfileSection`.
 */
export function defaultTileLabel(
  type: ArtistBlockTypeName,
  url = "",
): string | null {
  switch (type) {
    case "GALLERY":
      return "Photos";
    case "SOUNDCLOUD_TRACK":
    case "SOUNDCLOUD_PLAYLIST":
      return "Listen · SoundCloud";
    case "SPOTIFY_EMBED":
      return "Listen · Spotify";
    case "YOUTUBE_VIDEO":
      return "Watch";
    case "RELEASE":
      return "Out now";
    case "SOCIAL_LINKS":
      return "Find me";
    case "LINK_LIST":
      return "Links";
    case "CUSTOM_EMBED":
      try {
        return new URL(url).hostname.replace(/^www\./, "");
      } catch {
        return null;
      }
    default:
      return null;
  }
}
