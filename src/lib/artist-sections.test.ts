import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { readLayout, toSections, type StoredBlock } from "./artist-sections";

const ctx = {
  socials: 0,
  upcoming: 2,
  past: 3,
  mediaUrl: (id: string) => `/media/${id}`,
};

const block = (
  id: string,
  type: StoredBlock["type"],
  y: number,
  data: unknown = {},
  x = 0,
  w = 12,
  h = 2,
): StoredBlock => ({ id, type, x, y, w, h, data });

describe("toSections", () => {
  test("reads the grid top to bottom, left to right", () => {
    const sections = toSections(
      [
        block("b", "HEADING", 4, { text: "Listen" }, 0, 6),
        block("c", "DIVIDER", 4, {}, 6, 6),
        block("a", "GIG_LIST", 0),
      ],
      ctx,
    );
    assert.deepEqual(
      sections.map((s) => [s.id, s.x, s.y]),
      [
        ["a", 0, 0],
        ["b", 0, 2],
        ["c", 6, 2],
      ],
    );
  });

  test("drops sections with nothing to show and closes the gap", () => {
    const sections = toSections(
      [
        block("h", "HEADING", 0, { text: "  " }),
        block("s", "SOCIAL_LINKS", 2),
        block("y", "YOUTUBE_VIDEO", 4, { url: "https://example.com" }),
        block("i", "IMAGE", 6, { fileId: "f1" }, 0, 6, 10),
      ],
      ctx,
    );
    assert.deepEqual(sections, [
      {
        id: "i",
        type: "IMAGE",
        src: "/media/f1",
        alt: "",
        x: 0,
        y: 0,
        w: 6,
        h: 10,
      },
    ]);
  });

  test("shows an unarranged profile's sets and past sets", () => {
    assert.deepEqual(
      toSections([], ctx).map((s) => s.type),
      ["GIG_LIST", "PAST_GIGS"],
    );
    assert.deepEqual(toSections([], { ...ctx, upcoming: 0, past: 0 }), []);
  });
});

describe("readLayout", () => {
  test("rescales layouts saved with 60px rows", () => {
    const [text, image] = readLayout(
      [
        block("i", "IMAGE", 0, { fileId: "f" }, 6, 6, 8),
        block("t", "RICH_TEXT", 0, {}, 0, 6, 4),
      ],
      60,
    );
    // 4 * 60 + 3 * 12 = 276px; 8 * 60 + 7 * 12 = 564px.
    assert.deepEqual([text!.id, text!.h], ["t", 8]);
    assert.deepEqual([image!.id, image!.h], ["i", 15]);
  });

  test("gives photos room when they were saved as one-row list items", () => {
    const [image] = readLayout(
      [block("i", "IMAGE", 0, { fileId: "f" }, 0, 12, 1)],
      60,
    );
    assert.equal(image!.h, 12);
  });
});
