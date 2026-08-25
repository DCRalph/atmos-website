export type CreatorBlockTypeName =
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

export type ClientBlock = {
  id: string;
  /** Blocks that have never been persisted have this set so the server
   * treats them as creates. */
  isNew?: boolean;
  type: CreatorBlockTypeName;
  x: number;
  y: number;
  w: number;
  h: number;
  data: Record<string, unknown>;
};

/**
 * How a block relates to the height it is given:
 *
 * - `"intrinsic"` — the content has a natural height (text, link lists, fixed
 *   embeds, aspect-ratio video). The block's `h` is derived from the rendered
 *   content, never set by hand: the editor measures and snaps it, and the
 *   public grid re-fits it at the published width. Resizing changes width only.
 * - `"fill"` — the content stretches to whatever box it's given (cover images,
 *   galleries, scalable embeds, spacers). `h` is freely user-resizable.
 */
export type BlockSizing = "intrinsic" | "fill";

export type BlockTypeDefinition = {
  type: CreatorBlockTypeName;
  label: string;
  description: string;
  sizing: BlockSizing;
  defaultW: number;
  defaultH: number;
  defaultData: Record<string, unknown>;
};

// CONTENT_LIST stays in the type union (the DB enum has it) but is not offered
// or rendered anywhere until the block actually exists.
export const BLOCK_TYPES: BlockTypeDefinition[] = [
  {
    type: "HEADING",
    label: "Heading",
    description: "Large text header",
    sizing: "intrinsic",
    defaultW: 12,
    defaultH: 2,
    defaultData: { text: "Section heading", level: 2, align: "left" },
  },
  {
    type: "RICH_TEXT",
    label: "Text",
    description: "Bio or description",
    sizing: "intrinsic",
    defaultW: 8,
    defaultH: 4,
    defaultData: {},
  },
  {
    type: "IMAGE",
    label: "Image",
    description: "Single image",
    sizing: "fill",
    defaultW: 6,
    defaultH: 6,
    defaultData: { fileId: null as string | null, alt: "" },
  },
  {
    type: "GALLERY",
    label: "Gallery",
    description: "Multiple images grid",
    sizing: "fill",
    defaultW: 12,
    defaultH: 6,
    defaultData: { fileIds: [] as string[] },
  },
  {
    type: "SOUNDCLOUD_TRACK",
    label: "SoundCloud track",
    description: "Embed a single SoundCloud track",
    sizing: "intrinsic",
    defaultW: 12,
    defaultH: 3,
    defaultData: { url: "" },
  },
  {
    type: "SOUNDCLOUD_PLAYLIST",
    label: "SoundCloud playlist",
    description: "Embed a SoundCloud playlist",
    sizing: "fill",
    defaultW: 12,
    defaultH: 7,
    defaultData: { url: "" },
  },
  {
    type: "YOUTUBE_VIDEO",
    label: "YouTube video",
    description: "Embed a YouTube video",
    sizing: "intrinsic",
    defaultW: 8,
    defaultH: 6,
    defaultData: { url: "" },
  },
  {
    type: "SPOTIFY_EMBED",
    label: "Spotify embed",
    description: "Track, album or playlist",
    sizing: "fill",
    defaultW: 6,
    defaultH: 6,
    defaultData: { url: "" },
  },
  {
    type: "SOCIAL_LINKS",
    label: "Social links",
    description: "Display your social links",
    sizing: "intrinsic",
    defaultW: 12,
    defaultH: 2,
    defaultData: {},
  },
  {
    type: "LINK_LIST",
    label: "Link list",
    description: "Custom list of buttons/links",
    sizing: "intrinsic",
    defaultW: 6,
    defaultH: 5,
    defaultData: { links: [] as Array<{ label: string; url: string }> },
  },
  {
    type: "GIG_LIST",
    label: "Gigs",
    description: "Gigs you're attributed to",
    sizing: "intrinsic",
    defaultW: 12,
    defaultH: 6,
    defaultData: { source: "auto", gigIds: [] as string[] },
  },
  {
    type: "PAST_GIGS",
    label: "Past gigs",
    description: "Auto-pulled highlight of gigs you played",
    sizing: "intrinsic",
    defaultW: 12,
    defaultH: 5,
    defaultData: {
      title: "Past gigs",
      includeUpcoming: false,
      showRole: true,
    },
  },
  {
    type: "DIVIDER",
    label: "Divider",
    description: "Horizontal rule",
    sizing: "intrinsic",
    defaultW: 12,
    defaultH: 1,
    defaultData: {},
  },
  {
    type: "SPACER",
    label: "Spacer",
    description: "Empty vertical space",
    sizing: "fill",
    defaultW: 12,
    defaultH: 2,
    defaultData: {},
  },
  {
    type: "CUSTOM_EMBED",
    label: "Custom embed",
    description: "Paste any iframe URL",
    sizing: "fill",
    defaultW: 12,
    defaultH: 6,
    defaultData: { url: "" },
  },
];

export function getBlockDef(
  type: CreatorBlockTypeName,
): BlockTypeDefinition | undefined {
  return BLOCK_TYPES.find((b) => b.type === type);
}

/** Unknown/legacy types measure as intrinsic so they can never reserve space. */
export function getBlockSizing(type: CreatorBlockTypeName): BlockSizing {
  return getBlockDef(type)?.sizing ?? "intrinsic";
}

/**
 * Smallest number of grid rows whose box fits `neededPx` of content.
 * A block spanning `h` rows is `h * rowPx + (h - 1) * gapPx` tall.
 */
export function fitRows(
  neededPx: number,
  rowPx: number,
  gapPx: number,
): number {
  return Math.max(1, Math.ceil((neededPx + gapPx) / (rowPx + gapPx)));
}

/**
 * Re-pack a layout after some blocks changed height (or were filtered out),
 * keeping every block's x/w and the original top-to-bottom, left-to-right
 * order. For an already-compact layout with no height changes this is the
 * identity, so it is safe to run on the server render too.
 */
export function fitLayout<B extends ClientBlock>(
  blocks: B[],
  heightFor: (block: B) => number,
): B[] {
  const sorted = [...blocks].sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: B[] = [];
  for (const block of sorted) {
    const h = Math.max(1, heightFor(block));
    let y = 0;
    while (collides(placed, { x: block.x, y, w: block.w, h })) y += 1;
    placed.push({ ...block, y, h });
  }
  return placed;
}

/**
 * Layout helpers: find the first free top-left slot of the given size
 * inside a virtual grid `cols` wide.
 */
export function findFreeSlot(
  blocks: ClientBlock[],
  cols: number,
  w: number,
  h: number,
): { x: number; y: number } {
  const maxY = Math.max(0, ...blocks.map((b) => b.y + b.h));
  for (let y = 0; y <= maxY + 1; y++) {
    for (let x = 0; x <= cols - w; x++) {
      if (!collides(blocks, { x, y, w, h })) {
        return { x, y };
      }
    }
  }
  return { x: 0, y: maxY + 1 };
}

export function collides(
  blocks: ClientBlock[],
  rect: { x: number; y: number; w: number; h: number; id?: string },
): boolean {
  return blocks.some((b) => {
    if (rect.id && b.id === rect.id) return false;
    if (b.x + b.w <= rect.x) return false;
    if (rect.x + rect.w <= b.x) return false;
    if (b.y + b.h <= rect.y) return false;
    if (rect.y + rect.h <= b.y) return false;
    return true;
  });
}

/**
 * Compact blocks towards the top - if a block has vertical space above it with
 * no collision, move it up. Called after every drag/resize to keep the layout
 * clean.
 */
export function compactLayout(
  blocks: ClientBlock[],
  _cols: number,
): ClientBlock[] {
  const sorted = [...blocks].sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: ClientBlock[] = [];
  for (const block of sorted) {
    let y = block.y;
    while (y > 0) {
      const candidate = { ...block, y: y - 1 };
      if (collides(placed, candidate)) break;
      y -= 1;
    }
    placed.push({ ...block, y });
  }
  return placed;
}

/**
 * Move / resize a block. Pushes overlapping blocks downward to resolve
 * collisions. Returns a new blocks array.
 */
export function applyLayoutChange(
  blocks: ClientBlock[],
  updated: ClientBlock,
  cols: number,
): ClientBlock[] {
  const others = blocks.filter((b) => b.id !== updated.id);
  // Clamp to grid bounds
  const clamped: ClientBlock = {
    ...updated,
    x: Math.max(0, Math.min(cols - updated.w, updated.x)),
    y: Math.max(0, updated.y),
    w: Math.max(1, Math.min(cols, updated.w)),
    h: Math.max(1, updated.h),
  };
  const resolved = resolveOverlaps(others, clamped);
  return compactLayout([...resolved, clamped], cols);
}

function resolveOverlaps(
  others: ClientBlock[],
  moving: ClientBlock,
): ClientBlock[] {
  const result: ClientBlock[] = [];
  for (const other of others) {
    if (rectsOverlap(other, moving)) {
      const pushedY = moving.y + moving.h;
      result.push({ ...other, y: pushedY });
    } else {
      result.push(other);
    }
  }
  // Re-check newly-pushed blocks against each other
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i]!;
        const b = result[j]!;
        if (rectsOverlap(a, b)) {
          const lower = a.y >= b.y ? a : b;
          const upper = a.y >= b.y ? b : a;
          const upperIdx = result.indexOf(upper);
          result[upperIdx] = { ...upper, y: lower.y + lower.h };
          changed = true;
        }
      }
    }
  }
  return result;
}

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  if (a.x + a.w <= b.x) return false;
  if (b.x + b.w <= a.x) return false;
  if (a.y + a.h <= b.y) return false;
  if (b.y + b.h <= a.y) return false;
  return true;
}
