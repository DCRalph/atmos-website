import { describe, test } from "bun:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  RESERVED_SLUGS,
  destinationProblem,
  normaliseSlug,
  slugProblem,
} from "./rules";

/**
 * Every path segment the app serves at its root, read off `src/app`: plain
 * folders, plus the folders inside route groups like `(main)`. Dynamic,
 * private, parallel-route and dotted folders (`.well-known`) can never be a
 * slug, so they are skipped.
 */
function topLevelRoutes(): string[] {
  const appDir = fileURLToPath(new URL("../../app", import.meta.url));
  const folders = (dir: string) =>
    readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

  return folders(appDir)
    .flatMap((name) =>
      /^\(.+\)$/.test(name) ? folders(`${appDir}/${name}`) : [name],
    )
    .filter((name) => !/^[[_@.]/.test(name));
}

describe("RESERVED_SLUGS", () => {
  // A site-domain link whose slug is also a page never fires: Next serves the
  // page. This keeps the list honest as pages are added.
  test("covers every top-level route in src/app", () => {
    const missing = topLevelRoutes().filter(
      (route) => !RESERVED_SLUGS.has(route),
    );
    assert.deepEqual(missing, []);
  });
});

describe("normaliseSlug", () => {
  test("accepts a pasted URL, slashes, capitals and spaces", () => {
    assert.equal(normaliseSlug(" https://atmosmedia.co.nz/Vol3/ "), "vol3");
    assert.equal(normaliseSlug("/Wellington Tickets"), "wellington-tickets");
  });
});

describe("slugProblem", () => {
  test("refuses a page's path anywhere the main site answers", () => {
    assert.match(slugProblem("events", "atmosmedia.co.nz") ?? "", /already/);
    assert.match(slugProblem("admin", "*") ?? "", /already/);
  });

  test("allows a page's path on an extra domain", () => {
    assert.equal(slugProblem("admin", "atms.nz"), null);
    assert.equal(slugProblem("about", "atms.nz"), null);
  });

  test("refuses anything but lowercase words and dashes", () => {
    assert.ok(slugProblem("vol--3", "atmosmedia.co.nz"));
    assert.ok(slugProblem("@handle", "atmosmedia.co.nz"));
    assert.ok(slugProblem("", "atmosmedia.co.nz"));
    assert.equal(slugProblem("vol-3", "atmosmedia.co.nz"), null);
  });
});

describe("destinationProblem", () => {
  test("allows http(s) and site paths only", () => {
    assert.equal(destinationProblem("https://moshtix.co.nz/x"), null);
    assert.equal(destinationProblem("/events/vol-3"), null);
    assert.ok(destinationProblem("//evil.example"));
    assert.ok(destinationProblem("javascript:alert(1)"));
    assert.ok(destinationProblem("moshtix.co.nz"));
  });
});
