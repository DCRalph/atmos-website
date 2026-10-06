import { describe, expect, test } from "bun:test";

import { loginHref, safeNextPath } from "./login-redirect";

describe("safeNextPath", () => {
  test("keeps same-site paths", () => {
    expect(safeNextPath("/admin/gigs?tab=past")).toBe("/admin/gigs?tab=past");
  });

  test("drops anything that could leave the site", () => {
    for (const next of [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "evil",
    ]) {
      expect(safeNextPath(next)).toBeNull();
    }
    expect(safeNextPath(["/a", "/b"])).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
  });
});

describe("loginHref", () => {
  test("encodes the path into next", () => {
    expect(loginHref("/door?event=1")).toBe("/login?next=%2Fdoor%3Fevent%3D1");
  });

  test("plain /login when there is nowhere useful to return to", () => {
    expect(loginHref(null)).toBe("/login");
    expect(loginHref("/")).toBe("/login");
  });
});
