import { getYouTubeId } from "./youtube";

/** Home's content grid: three squares across, two rows down on desktop. */
export const HOME_GRID_COLUMNS = 3;
export const HOME_GRID_CELLS = 6;

type HomeItem = {
  id: string;
  linkType: string;
  link: string;
  embedUrl: string | null;
};

/** A content item on the grid. `slot` is its first cell, counted row by row from 0. */
export type HomeTile<T> = {
  slot: number;
  span: 1 | 2;
  item: T;
  /** Filled in automatically rather than placed by an admin. */
  auto: boolean;
};

/** Where an admin put an item. Saved as `HomeContentPlacement.sortOrder`. */
export type HomeSlot = { slot: number; contentItemId: string };

export function contentVideoId(item: HomeItem) {
  return item.linkType === "YOUTUBE_VIDEO"
    ? (getYouTubeId(item.embedUrl) ?? getYouTubeId(item.link))
    : null;
}

/** Playable YouTube videos take two squares side by side; everything else takes one. */
export function tileSpan(item: HomeItem): 1 | 2 {
  return contentVideoId(item) ? 2 : 1;
}

/** The cells a tile starting at `slot` covers, or null when it would run off its row. */
export function tileCells(slot: number, span: 1 | 2) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= HOME_GRID_CELLS) {
    return null;
  }
  if ((slot % HOME_GRID_COLUMNS) + span > HOME_GRID_COLUMNS) return null;
  return span === 2 ? [slot, slot + 1] : [slot];
}

/**
 * Saved rows, as slots. The old layout saved one VIDEO row (two squares at the
 * top left) and ITEMS rows numbered 0 to 2 beneath it, so those map onto
 * slots 0 and 2 to 4. A save rewrites everything as ITEMS rows numbered by slot.
 */
export function placementSlots(
  placements: {
    section: "VIDEO" | "ITEMS";
    sortOrder: number;
    contentItemId: string;
  }[],
): HomeSlot[] {
  const legacy = placements.some((p) => p.section === "VIDEO");
  return placements.map((p) => ({
    contentItemId: p.contentItemId,
    slot: !legacy ? p.sortOrder : p.section === "VIDEO" ? 0 : p.sortOrder + 2,
  }));
}

/**
 * Lays out Home's grid. Saved slots go first, skipping missing items, repeats
 * and anything that overlaps or runs off a row. Each empty cell then takes the
 * newest unplaced item that fits there. `items` must arrive newest first.
 */
export function layoutHomeContent<T extends HomeItem>(
  items: readonly T[],
  slots: readonly HomeSlot[],
): HomeTile<T>[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const taken = new Set<number>();
  const used = new Set<string>();
  const tiles: HomeTile<T>[] = [];
  const place = (item: T, slot: number, auto: boolean) => {
    const span = tileSpan(item);
    const cells = tileCells(slot, span);
    if (used.has(item.id) || !cells || cells.some((c) => taken.has(c))) {
      return false;
    }
    for (const c of cells) taken.add(c);
    used.add(item.id);
    tiles.push({ slot, span, item, auto });
    return true;
  };

  for (const { slot, contentItemId } of slots) {
    const item = byId.get(contentItemId);
    if (item) place(item, slot, false);
  }
  for (let slot = 0; slot < HOME_GRID_CELLS; slot++) {
    if (taken.has(slot)) continue;
    for (const item of items) {
      if (place(item, slot, true)) break;
    }
  }
  return tiles.sort((a, b) => a.slot - b.slot);
}

/** Where a tile dropped on `slot` starts: two-square tiles shift left off a row's last cell. */
export function dropStart(slot: number, span: 1 | 2) {
  return span === 2 && slot % HOME_GRID_COLUMNS === HOME_GRID_COLUMNS - 1
    ? slot - 1
    : slot;
}

/**
 * Drops `item` into the grid at `slot`, for the admin editor. A two-square
 * tile dropped on a row's last cell starts one cell earlier. Tiles it covers
 * move into the cells it left when they fit, then into the first free cells,
 * and come off the grid when there is no room.
 */
export function dropHomeTile(
  slots: readonly HomeSlot[],
  item: HomeItem,
  slot: number,
  spanOf: (contentItemId: string) => 1 | 2,
): HomeSlot[] {
  const span = tileSpan(item);
  const start = dropStart(slot, span);
  const cells = tileCells(start, span);
  if (!cells) return [...slots];

  const from = slots.find((s) => s.contentItemId === item.id)?.slot;
  const others = slots.filter((s) => s.contentItemId !== item.id);
  const covers = (s: HomeSlot) =>
    tileCells(s.slot, spanOf(s.contentItemId))?.some((c) => cells.includes(c));
  const next: HomeSlot[] = [
    ...others.filter((s) => !covers(s)),
    { slot: start, contentItemId: item.id },
  ];
  const fits = (s: number, id: string) => {
    const want = tileCells(s, spanOf(id));
    return (
      want !== null &&
      !next.some((t) =>
        tileCells(t.slot, spanOf(t.contentItemId))?.some((c) =>
          want.includes(c),
        ),
      )
    );
  };
  for (const moved of others.filter(covers)) {
    const target = [
      ...(from === undefined ? [] : [from]),
      ...Array.from({ length: HOME_GRID_CELLS }, (_, i) => i),
    ].find((s) => fits(s, moved.contentItemId));
    if (target !== undefined) {
      next.push({ slot: target, contentItemId: moved.contentItemId });
    }
  }
  return next.sort((a, b) => a.slot - b.slot);
}
