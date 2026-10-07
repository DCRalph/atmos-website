export type ArtistBlockTypeName =
  | "HEADING"
  | "RICH_TEXT"
  | "IMAGE"
  | "GALLERY"
  | "SOUNDCLOUD_TRACK"
  | "SOUNDCLOUD_PLAYLIST"
  | "YOUTUBE_VIDEO"
  | "SPOTIFY_EMBED"
  | "SOCIAL_LINKS"
  | "LINK_LIST"
  | "GIG_LIST"
  | "PAST_GIGS"
  | "CONTENT_LIST"
  | "DIVIDER"
  | "SPACER"
  | "CUSTOM_EMBED";

/**
 * A section as the profile builder holds it. Sections are stored as
 * `ArtistBlock` rows, whose grid columns (`x`, `w`, `h`) are left over from
 * the old free-form editor: the builder writes `y` as the section's position
 * and fixed values for the rest. See `~/lib/artist-sections`.
 */
export type ClientBlock = {
  id: string;
  /** Blocks that have never been persisted have this set so the server
   * treats them as creates. */
  isNew?: boolean;
  type: ArtistBlockTypeName;
  x: number;
  y: number;
  w: number;
  h: number;
  data: Record<string, unknown>;
};

export type BlockTypeDefinition = {
  type: ArtistBlockTypeName;
  label: string;
  description: string;
  defaultData: Record<string, unknown>;
};

// CONTENT_LIST stays in the type union (the DB enum has it) but is not offered
// or rendered anywhere until the block actually exists.
export const BLOCK_TYPES: BlockTypeDefinition[] = [
  {
    type: "HEADING",
    label: "Heading",
    description: "A big title that starts a part of your page",
    defaultData: { text: "", level: 2, align: "left" },
  },
  {
    type: "RICH_TEXT",
    label: "Text",
    description: "Paragraphs, lists and links",
    defaultData: {},
  },
  {
    type: "GIG_LIST",
    label: "Upcoming sets",
    description: "Your next sets from Atmos lineups",
    defaultData: { title: "Sets" },
  },
  {
    type: "PAST_GIGS",
    label: "Past sets",
    description: "Every set you've played on Atmos lineups",
    defaultData: { title: "Past sets", includeUpcoming: false, showRole: true },
  },
  {
    type: "SOUNDCLOUD_TRACK",
    label: "SoundCloud track",
    description: "One track, in a compact player",
    defaultData: { url: "" },
  },
  {
    type: "SOUNDCLOUD_PLAYLIST",
    label: "SoundCloud playlist",
    description: "A set or playlist, with artwork",
    defaultData: { url: "" },
  },
  {
    type: "SPOTIFY_EMBED",
    label: "Spotify",
    description: "A track, album or playlist",
    defaultData: { url: "" },
  },
  {
    type: "YOUTUBE_VIDEO",
    label: "YouTube video",
    description: "One video",
    defaultData: { url: "" },
  },
  {
    type: "IMAGE",
    label: "Image",
    description: "One photo, full width",
    defaultData: { fileId: null as string | null, alt: "" },
  },
  {
    type: "GALLERY",
    label: "Photos",
    description: "A grid of photos that open full screen",
    defaultData: { fileIds: [] as string[] },
  },
  {
    type: "LINK_LIST",
    label: "Links",
    description: "Bookings, press kit, merch: big rows that link out",
    defaultData: { links: [] as Array<{ label: string; url: string }> },
  },
  {
    type: "SOCIAL_LINKS",
    label: "Social links",
    description: "Your socials as big rows (they're always in the header too)",
    defaultData: {},
  },
  {
    type: "CUSTOM_EMBED",
    label: "Embed",
    description: "Any embeddable page, in a 16:9 frame",
    defaultData: { url: "" },
  },
  {
    type: "DIVIDER",
    label: "Divider",
    description: "A thin line between parts",
    defaultData: {},
  },
  {
    type: "SPACER",
    label: "Space",
    description: "Extra room between parts",
    defaultData: {},
  },
];

export function getBlockDef(
  type: ArtistBlockTypeName,
): BlockTypeDefinition | undefined {
  return BLOCK_TYPES.find((b) => b.type === type);
}

/** Section order is position in the list; the grid columns get fixed values. */
export const toStoredOrder = (blocks: ClientBlock[]): ClientBlock[] =>
  blocks.map((b, i) => ({ ...b, x: 0, y: i, w: 12, h: 1 }));
