import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { toSections, type StoredBlock } from "./creator-sections";

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
): StoredBlock => ({ id, type, x, y, data });

describe("toSections", () => {
  test("keeps the builder's order, reading old grid rows top to bottom", () => {
    const sections = toSections(
      [
        block("b", "HEADING", 4, { text: "Listen" }),
        block("c", "DIVIDER", 4, {}, 6),
        block("a", "GIG_LIST", 0),
      ],
      ctx,
    );
    assert.deepEqual(
      sections.map((s) => s.id),
      ["a", "b", "c"],
    );
  });

  test("drops sections with nothing to show", () => {
    const sections = toSections(
      [
        block("h", "HEADING", 0, { text: "  " }),
        block("s", "SOCIAL_LINKS", 1),
        block("y", "YOUTUBE_VIDEO", 2, { url: "https://example.com" }),
        block("i", "IMAGE", 3, { fileId: "f1" }),
      ],
      ctx,
    );
    assert.deepEqual(sections, [
      { id: "i", type: "IMAGE", src: "/media/f1", alt: "" },
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
