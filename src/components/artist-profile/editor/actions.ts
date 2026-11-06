import {
  getBlockDef,
  newBlock,
  tempId,
  type ArtistBlockTypeName,
  type ClientBlock,
} from "~/lib/artist-blocks";
import {
  GRID,
  appendBlock,
  insertAfter,
  nudgeBlock,
  removeBlock,
  resizeBlock,
} from "~/lib/artist-grid";
import type { EditorStore } from "./store";

/**
 * Block changes the grid, the panels and the keyboard share. Each one is a
 * single undoable step.
 */

export function addBlock(store: EditorStore, type: ArtistBlockTypeName) {
  const block = newBlock(type);
  store.getState().commit((blocks) => appendBlock(blocks, block));
  store.getState().select(block.id);
}

export function duplicate(store: EditorStore, id: string) {
  const s = store.getState();
  const block = s.blocks.find((b) => b.id === id);
  if (!block) return;
  const copy: ClientBlock = {
    ...block,
    id: tempId(),
    isNew: true,
    data: structuredClone(block.data),
  };
  s.commit((blocks) => insertAfter(blocks, id, copy));
  s.select(copy.id);
}

export function remove(store: EditorStore, id: string) {
  const s = store.getState();
  s.commit((blocks) => removeBlock(blocks, id));
  if (s.selectedId === id) s.select(null);
}

/** Swap with the block above (-1) or below (1) in the same columns. */
export const nudge = (store: EditorStore, id: string, dir: -1 | 1) =>
  store.getState().commit((blocks) => nudgeBlock(blocks, id, dir));

/** Move sideways by `dx` columns. */
export function shift(store: EditorStore, id: string, dx: number) {
  store.getState().commit((blocks) => {
    const block = blocks.find((b) => b.id === id);
    if (!block) return blocks;
    const x = Math.min(GRID.cols - block.w, Math.max(0, block.x + dx));
    return x === block.x ? blocks : resizeBlock(blocks, id, { x });
  });
}

/** Set the width in columns, moving left if it would run off the grid. */
export function setWidth(store: EditorStore, id: string, w: number) {
  store.getState().commit((blocks) => {
    const block = blocks.find((b) => b.id === id);
    if (!block) return blocks;
    const width = Math.min(
      GRID.cols,
      Math.max(getBlockDef(block.type).minW, w),
    );
    if (width === block.w) return blocks;
    const x = Math.min(block.x, GRID.cols - width);
    return resizeBlock(blocks, id, { x, w: width });
  });
}

/** Set a photo's or embed's height in rows. */
export function setHeight(store: EditorStore, id: string, h: number) {
  store.getState().commit((blocks) => {
    const block = blocks.find((b) => b.id === id);
    if (!block) return blocks;
    const height = Math.max(getBlockDef(block.type).minH, h);
    return height === block.h ? blocks : resizeBlock(blocks, id, { h: height });
  });
}

/** Change a block's settings. Typing into one block undoes as one step. */
export function updateData(
  store: EditorStore,
  id: string,
  patch: Record<string, unknown>,
) {
  store
    .getState()
    .commit(
      (blocks) =>
        blocks.map((b) =>
          b.id === id ? { ...b, data: { ...b.data, ...patch } } : b,
        ),
      `data:${id}`,
    );
}
