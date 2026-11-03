import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { pageOf, sourceLabel } from "./page-views";

describe("pageOf", () => {
  test("names fixed pages", () => {
    assert.deepEqual(pageOf("/"), { group: "site", name: "Home" });
    assert.deepEqual(pageOf("/gigs"), { group: "site", name: "Gigs list" });
  });

  test("keys gigs and events by what follows the section", () => {
    assert.deepEqual(pageOf("/gigs/night-moves"), {
      group: "gigs",
      name: "night-moves",
      key: "night-moves",
    });
    assert.deepEqual(pageOf("/events/nova")?.group, "events");
  });

  test("names a product from its handle", () => {
    assert.deepEqual(pageOf("/merch/black-hoodie"), {
      group: "site",
      name: "Merch: Black hoodie",
    });
  });

  test("refuses anything else, so made-up paths are never stored", () => {
    for (const path of [
      "/admin",
      "/gigs/",
      "/gigs/a/b",
      "/about/",
      "/events/<script>",
      "/constructor",
    ]) {
      assert.equal(pageOf(path), null, path);
    }
  });
});

test("sourceLabel", () => {
  assert.equal(sourceLabel("instagram"), "Instagram");
  assert.equal(sourceLabel("direct"), "Direct");
  assert.equal(sourceLabel("news.co.nz"), "news.co.nz");
  assert.equal(sourceLabel("constructor"), "Constructor");
});
