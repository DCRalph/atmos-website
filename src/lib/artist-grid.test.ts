import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import {
  moveBlock,
  normalize,
  nudgeBlock,
  pxToRows,
  rescaleRows,
  resizeBlock,
  rowsToPx,
  settle,
  toTree,
  type GridNode,
  type Rect,
} from "./artist-grid";

type B = Rect & { id: string };
const b = (id: string, x: number, y: number, w: number, h: number): B => ({
  id,
  x,
  y,
  w,
  h,
});
const at = (blocks: B[]) =>
  Object.fromEntries(blocks.map((x) => [x.id, [x.x, x.y, x.w, x.h]]));

describe("rows", () => {
  test("px and rows agree", () => {
    assert.equal(rowsToPx(1), 16);
    assert.equal(rowsToPx(3), 96);
    assert.equal(pxToRows(16), 1);
    assert.equal(pxToRows(17), 2);
    assert.equal(pxToRows(96), 3);
    assert.equal(pxToRows(0), 1);
  });

  test("old 60px rows keep roughly their height", () => {
    // 8 old rows: 8 * 60 + 7 * 12 = 564px, about 14 new rows (536px).
    assert.equal(rescaleRows(8, 60), 15);
    assert.equal(rescaleRows(8, 16), 8);
  });
});

describe("settle", () => {
  test("drops each block onto the ones before it in its columns", () => {
    const out = settle([
      b("a", 0, 9, 6, 4),
      b("b", 6, 9, 6, 2),
      b("c", 0, 0, 12, 1),
    ]);
    assert.deepEqual(at(out), {
      a: [0, 0, 6, 4],
      b: [6, 0, 6, 2],
      c: [0, 4, 12, 1],
    });
  });

  test("clamps into the grid", () => {
    assert.deepEqual(at(settle([b("a", 10, 0, 6, 0)])), { a: [6, 0, 6, 1] });
  });

  test("a settled layout settles to itself", () => {
    const once = normalize([
      b("a", 0, 0, 6, 10),
      b("b", 6, 0, 6, 3),
      b("c", 6, 3, 6, 3),
      b("d", 0, 12, 12, 2),
    ]);
    assert.deepEqual(normalize(once), once);
  });
});

describe("moving", () => {
  const column = () =>
    normalize([b("a", 0, 0, 6, 4), b("b", 0, 4, 6, 4), b("c", 0, 8, 6, 4)]);

  test("dragging past the middle of the next block swaps with it", () => {
    assert.deepEqual(
      moveBlock(column(), "a", { x: 0, y: 1 }).map((x) => x.id),
      ["a", "b", "c"],
    );
    // Without "a", "b" sits at 0..4 with its middle at 2.
    assert.deepEqual(
      moveBlock(column(), "a", { x: 0, y: 3 }).map((x) => x.id),
      ["b", "a", "c"],
    );
  });

  test("moving into another column lands in that column's order", () => {
    const layout = normalize([...column(), b("r", 6, 0, 6, 6)]);
    const out = moveBlock(layout, "r", { x: 0, y: 3 });
    assert.deepEqual(at(out), {
      a: [0, 0, 6, 4],
      r: [0, 4, 6, 6],
      b: [0, 10, 6, 4],
      c: [0, 14, 6, 4],
    });
  });

  test("resizing wider pushes what it now covers below it", () => {
    const layout = normalize([b("a", 0, 0, 6, 4), b("r", 6, 0, 6, 2)]);
    assert.deepEqual(at(resizeBlock(layout, "a", { w: 12 })), {
      a: [0, 0, 12, 4],
      r: [6, 4, 6, 2],
    });
  });

  test("nudging swaps with the neighbour in the same columns", () => {
    const layout = normalize([...column(), b("r", 6, 0, 6, 2)]);
    assert.deepEqual(
      nudgeBlock(layout, "c", -1)
        .filter((x) => x.x === 0)
        .map((x) => x.id),
      ["a", "c", "b"],
    );
    assert.deepEqual(
      nudgeBlock(layout, "a", 1)
        .filter((x) => x.x === 0)
        .map((x) => x.id),
      ["b", "a", "c"],
    );
    assert.deepEqual(nudgeBlock(layout, "a", -1), layout);
  });
});

const shape = (node: GridNode<B>): unknown => {
  switch (node.kind) {
    case "block":
      return node.block.id;
    case "stack":
      return node.children.map(shape);
    case "row":
      return { row: node.children.map((c) => [c.x, c.w, shape(c.node)]) };
    case "free":
      return { free: node.blocks.map((x) => x.id) };
  }
};

describe("toTree", () => {
  test("cuts into stacks and rows", () => {
    // A heading, a tall text beside a column of players, then a full row.
    const layout = normalize([
      b("heading", 0, 0, 12, 2),
      b("text", 0, 2, 6, 19),
      b("embed", 6, 2, 6, 9),
      b("spotify", 6, 11, 6, 3),
      b("socials", 0, 21, 6, 2),
      b("past", 0, 30, 12, 5),
    ]);
    assert.deepEqual(shape(toTree(layout)), [
      { row: [[0, 12, "heading"]] },
      {
        row: [
          [0, 6, ["text", "socials"].map((id) => ({ row: [[0, 6, id]] }))],
          [6, 6, ["embed", "spotify"].map((id) => ({ row: [[0, 6, id]] }))],
        ],
      },
      { row: [[0, 12, "past"]] },
    ]);
  });

  test("keeps empty columns at the side", () => {
    assert.deepEqual(shape(toTree([b("a", 1, 0, 10, 3)])), {
      row: [[1, 10, "a"]],
    });
  });

  test("lines up a block that starts just above the rest", () => {
    // Two columns ending two rows apart, then a photo and a gallery under
    // them, each resting on its own column: no clean cut, but nearly.
    const layout = normalize([
      b("text", 0, 0, 6, 20),
      b("socials", 0, 20, 6, 4),
      b("video", 6, 0, 6, 26),
      b("photo", 0, 24, 4, 10),
      b("gallery", 4, 26, 8, 10),
    ]);
    assert.deepEqual(shape(toTree(layout)), [
      {
        row: [
          [0, 6, [{ row: [[0, 6, "text"]] }, { row: [[0, 6, "socials"]] }]],
          [6, 6, "video"],
        ],
      },
      {
        row: [
          [0, 4, "photo"],
          [4, 8, "gallery"],
        ],
      },
    ]);
  });

  test("interlocking blocks fall back to a free grid", () => {
    const pinwheel = normalize([
      b("a", 0, 0, 8, 6),
      b("b", 8, 0, 4, 12),
      b("c", 0, 6, 4, 12),
      b("d", 4, 6, 4, 6),
      b("e", 4, 12, 8, 6),
    ]);
    const tree = toTree(pinwheel);
    assert.equal(tree.kind, "free");
  });
});
