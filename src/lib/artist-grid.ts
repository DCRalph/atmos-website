/**
 * The grid under an artist profile's hero. Blocks sit on 12 columns and rows
 * of `GRID.row` px with `GRID.gap` between both, stored as `x`, `y`, `w`, `h`
 * in those units (see `ArtistBlock`).
 *
 * Layouts have gravity: every block rests on the blocks above it, so the only
 * thing a layout says is which columns each block spans and the order they
 * land in. `settle` turns an order into positions; moving a block is putting
 * it somewhere else in that order. The editor draws this grid as it is;
 * public pages draw it through `toTree`, which lets text and sets take the
 * height their content needs at any width.
 */

export const GRID = { cols: 12, row: 16, gap: 24 } as const;

/** One row and the gap under it. */
export const STEP = GRID.row + GRID.gap;

export type Rect = { x: number; y: number; w: number; h: number };

/** Height in px of a block `h` rows tall. */
export const rowsToPx = (h: number) => h * GRID.row + (h - 1) * GRID.gap;

/** The fewest rows that fit `px` of content. */
export const pxToRows = (px: number) =>
  Math.max(1, Math.ceil((px + GRID.gap) / STEP));

/** Layouts saved before this grid used 60px rows with 12px gaps. */
const LEGACY = { row: 60, gap: 12 } as const;

/**
 * A height stored in rows of `fromRowPx` (the profile's `rowHeightPx`), in
 * today's rows. Layouts saved before the current grid are read through this.
 */
export function rescaleRows(h: number, fromRowPx: number) {
  if (fromRowPx === GRID.row) return h;
  const gap = fromRowPx === LEGACY.row ? LEGACY.gap : GRID.gap;
  return Math.max(
    1,
    Math.round((h * fromRowPx + (h - 1) * gap + GRID.gap) / STEP),
  );
}

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

const sharesColumns = (a: Pick<Rect, "x" | "w">, b: Pick<Rect, "x" | "w">) =>
  a.x < b.x + b.w && b.x < a.x + a.w;

/** Reading order: top to bottom, then left to right. */
export const byPosition = (a: Rect, b: Rect) => a.y - b.y || a.x - b.x;

/**
 * Drop each block, in order, onto the ones before it that share a column.
 * Widths and columns are clamped into the grid on the way.
 */
export function settle<B extends Rect>(ordered: readonly B[]): B[] {
  const placed: B[] = [];
  for (const block of ordered) {
    const w = clamp(Math.round(block.w), 1, GRID.cols);
    const x = clamp(Math.round(block.x), 0, GRID.cols - w);
    let y = 0;
    for (const p of placed)
      if (sharesColumns(p, { x, w })) y = Math.max(y, p.y + p.h);
    placed.push({ ...block, x, y, w, h: Math.max(1, Math.round(block.h)) });
  }
  return placed;
}

/** Any layout, settled in reading order. Settled layouts come back unchanged. */
export const normalize = <B extends Rect>(blocks: readonly B[]) =>
  settle([...blocks].sort(byPosition));

type Block = Rect & { id: string };

/**
 * Move a block so its top left is near grid cell (`x`, `y`). It lands in the
 * order before the first block in its columns whose middle is below `y`, so
 * dragging past half of a block swaps with it.
 */
export function moveBlock<B extends Block>(
  blocks: readonly B[],
  id: string,
  to: { x: number; y: number },
): B[] {
  const moving = blocks.find((b) => b.id === id);
  if (!moving) return [...blocks];
  const others = normalize(blocks.filter((b) => b.id !== id));
  const target = { ...moving, x: clamp(to.x, 0, GRID.cols - moving.w) };
  const i = others.findIndex(
    (o) => sharesColumns(o, target) && o.y + o.h / 2 > to.y,
  );
  return settle(
    i < 0
      ? [...others, target]
      : [...others.slice(0, i), target, ...others.slice(i)],
  );
}

/** Change a block's size (and column, for resizing from the left), keeping its place in the order. */
export function resizeBlock<B extends Block>(
  blocks: readonly B[],
  id: string,
  size: Partial<Pick<Rect, "x" | "w" | "h">>,
): B[] {
  return settle(
    [...blocks]
      .sort(byPosition)
      .map((b) => (b.id === id ? { ...b, ...size } : b)),
  );
}

/**
 * Swap a block with its nearest neighbour above (-1) or below (1) in the same
 * columns, for keyboard and button moves.
 */
export function nudgeBlock<B extends Block>(
  blocks: readonly B[],
  id: string,
  dir: -1 | 1,
): B[] {
  const ordered = normalize(blocks);
  const i = ordered.findIndex((b) => b.id === id);
  const moving = ordered[i];
  if (!moving) return ordered;
  const rest = ordered.filter((b) => b.id !== id);
  // Neighbours in reading order, nearest first.
  const candidates = dir < 0 ? rest.slice(0, i).reverse() : rest.slice(i);
  const next = candidates.find((b) => sharesColumns(b, moving));
  if (!next) return ordered;
  const at = rest.indexOf(next) + (dir < 0 ? 0 : 1);
  return settle([...rest.slice(0, at), moving, ...rest.slice(at)]);
}

/** Put a block at the bottom of its columns. */
export const appendBlock = <B extends Rect>(blocks: readonly B[], block: B) =>
  settle([...normalize(blocks), block]);

/** Put a copy right under the original. */
export function insertAfter<B extends Block>(
  blocks: readonly B[],
  id: string,
  copy: B,
): B[] {
  const ordered = normalize(blocks);
  const i = ordered.findIndex((b) => b.id === id);
  return settle([...ordered.slice(0, i + 1), copy, ...ordered.slice(i + 1)]);
}

export const removeBlock = <B extends Block>(
  blocks: readonly B[],
  id: string,
) => normalize(blocks.filter((b) => b.id !== id));

// ---------------------------------------------------------------------------
// Public rendering

/**
 * A layout as nested stacks and rows, which plain CSS can draw with each
 * block at its natural height:
 *
 *  - `stack`: parts one under the other, cut where no block crosses.
 *  - `row`: parts side by side on `cols` columns, cut where no block crosses.
 *  - `free`: blocks that interlock so neither cut exists, even after
 *    `nearCut` (rare). Drawn as a grid whose rows grow to fit.
 */
export type GridNode<B extends Rect> =
  | { kind: "block"; block: B }
  | { kind: "stack"; children: GridNode<B>[] }
  | {
      kind: "row";
      cols: number;
      children: { x: number; w: number; node: GridNode<B> }[];
    }
  | { kind: "free"; cols: number; x: number; blocks: B[] };

/**
 * `blocks` must be settled. `x0` and `cols` are the columns they live in.
 *
 * Cuts across the page are taken where every column above ends level, so a
 * row of blocks reads as a row. Where one column ends early (a short photo
 * beside long text, with more under the text), the columns are kept apart
 * instead, so what sits under the text stays under the text at any width.
 */
export function toTree<B extends Rect>(
  blocks: readonly B[],
  x0 = 0,
  cols: number = GRID.cols,
): GridNode<B> {
  const bands = levelBands(blocks);
  if (bands.length > 1)
    return { kind: "stack", children: bands.map((b) => toTree(b, x0, cols)) };

  const groups = columns(blocks);
  if (groups.length === 1 && blocks.length > 1) {
    const split = nearCut(blocks);
    if (split)
      return {
        kind: "stack",
        children: split.map((part) => toTree(normalize(part), x0, cols)),
      };
    return {
      kind: "free",
      cols,
      x: x0,
      blocks: [...blocks].sort(byPosition),
    };
  }
  return {
    kind: "row",
    cols,
    children: groups.map((group) => {
      const start = Math.min(...group.map((b) => b.x));
      const end = Math.max(...group.map((b) => b.x + b.w));
      return {
        x: start - x0,
        w: end - start,
        node:
          group.length === 1
            ? { kind: "block" as const, block: group[0]! }
            : toTree(group, start, end - start),
      };
    }),
  };
}

const columns = <B extends Rect>(blocks: readonly B[]) =>
  cut(
    [...blocks].sort((a, b) => a.x - b.x || a.y - b.y),
    (b) => b.x,
    (b) => b.x + b.w,
  );

/**
 * Horizontal bands, joined back together across any cut where a column above
 * ends more than a row early, as long as the joined band still splits into
 * columns.
 */
function levelBands<B extends Rect>(blocks: readonly B[]): B[][] {
  const bands = cut(
    [...blocks].sort(byPosition),
    (b) => b.y,
    (b) => b.y + b.h,
  );
  const out: B[][] = [];
  for (const band of bands) {
    const above = out.at(-1);
    if (above && !endsLevel(above, band[0]!.y)) {
      const joined = [...above, ...band];
      if (columns(joined).length > 1) {
        out[out.length - 1] = joined;
        continue;
      }
    }
    out.push(band);
  }
  return out;
}

/** How far `nearCut` may move a block down to line it up with a cut. */
const SNAP = 3;

/**
 * Where no clean cut exists because a block starts just above where the rest
 * line up (a photo two rows higher than the gallery beside it), cut there
 * anyway and move that block down onto the line. Takes the cut that moves
 * blocks least, or null when every cut would move one more than `SNAP` rows.
 */
function nearCut<B extends Rect>(blocks: readonly B[]): [B[], B[]] | null {
  let best: { moved: number; above: B[]; below: B[] } | null = null;
  const tops = [...new Set(blocks.map((b) => b.y))].sort((a, b) => a - b);
  for (const y of tops.slice(1)) {
    const above: B[] = [];
    const below: B[] = [];
    let moved = 0;
    let ok = true;
    for (const b of blocks) {
      if (b.y + b.h <= y) above.push(b);
      else if (b.y >= y) below.push(b);
      else if (y - b.y <= SNAP) {
        below.push({ ...b, y });
        moved += y - b.y;
      } else {
        ok = false;
        break;
      }
    }
    if (ok && above.length && below.length && (!best || moved < best.moved))
      best = { moved, above, below };
  }
  return best && [best.above, best.below];
}

/** Whether every column `blocks` use reaches down to within a row of `y`. */
function endsLevel(blocks: readonly Rect[], y: number) {
  const bottoms = new Map<number, number>();
  for (const b of blocks)
    for (let c = b.x; c < b.x + b.w; c++)
      bottoms.set(c, Math.max(bottoms.get(c) ?? 0, b.y + b.h));
  return [...bottoms.values()].every((bottom) => bottom >= y - 1);
}

/** Split sorted blocks wherever nothing spans the boundary between them. */
function cut<B>(
  sorted: readonly B[],
  start: (b: B) => number,
  end: (b: B) => number,
): B[][] {
  const parts: B[][] = [];
  let reach = -Infinity;
  for (const b of sorted) {
    if (start(b) >= reach || !parts.length) parts.push([]);
    parts.at(-1)!.push(b);
    reach = Math.max(reach, end(b));
  }
  return parts;
}

/**
 * Blocks in the order a phone shows them: `toTree`'s columns each read in
 * full before the next, so what sits under a block stays under it.
 */
export function readingOrder<B extends Rect>(blocks: readonly B[]): B[] {
  const settled = normalize(blocks);
  const out: B[] = [];
  const walk = (node: GridNode<B>) => {
    switch (node.kind) {
      case "block":
        out.push(node.block);
        break;
      case "stack":
        node.children.forEach(walk);
        break;
      case "row":
        node.children.forEach((c) => walk(c.node));
        break;
      case "free":
        out.push(...node.blocks);
    }
  };
  if (settled.length) walk(toTree(settled));
  return out;
}
