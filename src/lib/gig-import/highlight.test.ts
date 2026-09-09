import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { segmentCaption } from "./highlight";

/**
 * The quotes come back from a model, so they can repeat, nest, or be subtly
 * wrong. None of those may produce overlapping highlights or lose caption text.
 */

const caption = "NEON CHURCH\nFriday 23 October / Whammy Bar\n10pm til late";

const rejoin = (segments: { text: string }[]) =>
  segments.map((segment) => segment.text).join("");

describe("segmentCaption", () => {
  test("keeps every character of the caption", () => {
    const segments = segmentCaption(caption, [
      { field: "title", quote: "NEON CHURCH" },
      { field: "venue", quote: "Whammy Bar" },
      { field: "startsAt", quote: "10pm" },
    ]);
    assert.equal(rejoin(segments), caption);
  });

  test("attributes each quote to its field", () => {
    const segments = segmentCaption(caption, [
      { field: "title", quote: "NEON CHURCH" },
      { field: "venue", quote: "Whammy Bar" },
    ]);
    assert.deepEqual(
      segments.filter((segment) => segment.field !== null),
      [
        { text: "NEON CHURCH", field: "title" },
        { text: "Whammy Bar", field: "venue" },
      ],
    );
  });

  test("the longer quote wins when two overlap", () => {
    const segments = segmentCaption(caption, [
      { field: "startsAt", quote: "10pm til late" },
      { field: "endsAt", quote: "til late" },
    ]);
    const marked = segments.filter((segment) => segment.field !== null);
    assert.deepEqual(marked, [{ text: "10pm til late", field: "startsAt" }]);
    assert.equal(rejoin(segments), caption);
  });

  test("a quote that is not in the caption is dropped, not guessed at", () => {
    const segments = segmentCaption(caption, [
      { field: "title", quote: "Neon Church" },
    ]);
    assert.deepEqual(segments, [{ text: caption, field: null }]);
  });

  test("empty quotes never mark anything", () => {
    const segments = segmentCaption(caption, [{ field: "title", quote: "" }]);
    assert.deepEqual(segments, [{ text: caption, field: null }]);
  });

  test("an empty caption produces nothing to render", () => {
    assert.deepEqual(segmentCaption("", [{ field: "title", quote: "x" }]), []);
  });
});
