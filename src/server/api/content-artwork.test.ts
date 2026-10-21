import { describe, test } from "bun:test";
import assert from "node:assert/strict";
import { withContentArtwork } from "./content-artwork";

const content = {
  linkType: "OTHER",
  link: "https://example.test",
  embedUrl: null,
};

describe("public content artwork", () => {
  test("returns only the selected image URL and keeps the content fields", () => {
    assert.deepEqual(
      withContentArtwork({
        ...content,
        id: "mix",
        title: "A mix",
        image: { url: "https://media.example.test/cover.webp", status: "OK" },
      }),
      {
        ...content,
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
          ...content,
          id: "mix",
          image: { url: "https://media.example.test/cover.webp", status },
        }).imageUrl,
        null,
      );
    });
  }

  test("items with no artwork stay text only", () => {
    assert.deepEqual(
      withContentArtwork({ ...content, id: "mix", image: null }),
      {
        ...content,
        id: "mix",
        imageUrl: null,
      },
    );
  });

  test("uses a YouTube thumbnail when no custom artwork is available", () => {
    assert.equal(
      withContentArtwork({
        linkType: "YOUTUBE_VIDEO",
        link: "https://youtu.be/GeHLBAvSPqs",
        embedUrl: null,
        image: null,
      }).imageUrl,
      "https://i.ytimg.com/vi/GeHLBAvSPqs/hqdefault.jpg",
    );
  });

  test("custom artwork takes priority over a YouTube thumbnail", () => {
    assert.equal(
      withContentArtwork({
        linkType: "YOUTUBE_VIDEO",
        link: "https://youtu.be/GeHLBAvSPqs",
        embedUrl: "GeHLBAvSPqs",
        image: { url: "https://media.example.test/custom.webp", status: "OK" },
      }).imageUrl,
      "https://media.example.test/custom.webp",
    );
  });
});
