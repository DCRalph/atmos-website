import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import {
  CAMPAIGN_SOURCE_LABELS,
  CAMPAIGN_SOURCES,
  CAMPAIGN_TYPE_LABELS,
  CAMPAIGN_TYPES,
  campaignSourceOf,
  campaignTypeOf,
  campaignUrl,
  normaliseTag,
} from "./campaigns";

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

describe("campaign types", () => {
  test("a listed tag is its own type, anything else is other", () => {
    assert.equal(campaignTypeOf("story"), "story");
    assert.equal(campaignTypeOf("social"), "other");
    assert.equal(campaignTypeOf("referral"), "other");
    assert.equal(campaignTypeOf(null), "other");
  });

  test("sources go through their aliases", () => {
    assert.equal(campaignSourceOf("instagram"), "instagram");
    assert.equal(campaignSourceOf("ig"), "instagram");
    assert.equal(campaignSourceOf("twitter"), "x");
    assert.equal(campaignSourceOf("linktree"), "other");
    assert.equal(campaignSourceOf(undefined), "other");
  });

  test("every type and source has a label", () => {
    for (const type of CAMPAIGN_TYPES) assert.ok(CAMPAIGN_TYPE_LABELS[type]);
    for (const source of CAMPAIGN_SOURCES) {
      assert.ok(CAMPAIGN_SOURCE_LABELS[source]);
    }
  });
});
