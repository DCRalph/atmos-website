import { describe, test } from "bun:test";
import assert from "node:assert/strict";
import { withContentArtwork } from "./content-artwork";

describe("public content artwork", () => {
  test("returns only the selected image URL and keeps the content fields", () => {
    assert.deepEqual(
      withContentArtwork({
        id: "mix",
        title: "A mix",
        image: { url: "https://media.example.test/cover.webp", status: "OK" },
      }),
      {
        id: "mix",
        title: "A mix",
        imageUrl: "https://media.example.test/cover.webp",
      },
    );
  });

  for (const status of ["UPLOADING", "SOFT_DELETED", "DELETED", "FAILED"]) {
    test(`omits ${status} artwork instead of supplying a fallback`, () => {
      assert.equal(
        withContentArtwork({
          id: "mix",
          image: { url: "https://media.example.test/cover.webp", status },
        }).imageUrl,
        null,
      );
    });
  }

  test("items with no artwork stay text only", () => {
    assert.deepEqual(withContentArtwork({ id: "mix", image: null }), {
      id: "mix",
      imageUrl: null,
    });
  });
});
