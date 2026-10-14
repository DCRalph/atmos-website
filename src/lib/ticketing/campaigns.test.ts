import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { campaignUrl, normaliseTag } from "./campaigns";

describe("campaign links", () => {
  test("tags are written one way", () => {
    assert.equal(normaliseTag("  Final Release! "), "final-release");
    assert.equal(normaliseTag("Instagram"), "instagram");
  });

  test("a path goes on the site, and blank tags stay out", () => {
    assert.equal(
      campaignUrl("https://atmosmedia.co.nz", "/events/winter", {
        source: "instagram",
        medium: null,
        name: "final-release",
        content: null,
      }),
      "https://atmosmedia.co.nz/events/winter?utm_source=instagram&utm_campaign=final-release",
    );
  });

  test("an outside link keeps its host and its own query", () => {
    assert.equal(
      campaignUrl("https://atmosmedia.co.nz", "https://shop.example/x?a=1", {
        source: "poster",
        medium: "qr",
        name: "city-walls",
        content: "a3",
      }),
      "https://shop.example/x?a=1&utm_source=poster&utm_medium=qr&utm_campaign=city-walls&utm_content=a3",
    );
  });
});
