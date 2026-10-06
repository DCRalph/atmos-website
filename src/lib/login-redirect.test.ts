import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { loginHref, safeNextPath } from "./login-redirect";

describe("safeNextPath", () => {
  test("keeps same-site paths", () => {
    assert.equal(safeNextPath("/admin/gigs?tab=past"), "/admin/gigs?tab=past");
  });

  test("drops anything that could leave the site", () => {
    for (const next of [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "evil",
    ]) {
      assert.equal(safeNextPath(next), null);
    }
    assert.equal(safeNextPath(["/a", "/b"]), null);
    assert.equal(safeNextPath(undefined), null);
  });
});

describe("loginHref", () => {
  test("encodes the path into next", () => {
    assert.equal(loginHref("/door?event=1"), "/login?next=%2Fdoor%3Fevent%3D1");
  });

  test("plain /login when there is nowhere useful to return to", () => {
    assert.equal(loginHref(null), "/login");
    assert.equal(loginHref("/"), "/login");
  });
});
