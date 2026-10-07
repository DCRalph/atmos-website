import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { cleanTitle } from "./conversations";

describe("cleanTitle", () => {
  test("keeps the words and drops what small models wrap them in", () => {
    assert.equal(
      cleanTitle('"Create October draft gigs."'),
      "Create October draft gigs",
    );
    assert.equal(
      cleanTitle("Title: Update about page intro"),
      "Update about page intro",
    );
    assert.equal(
      cleanTitle('"Title: Update about page intro."'),
      "Update about page intro",
    );
    assert.equal(
      cleanTitle("\n**Delete Atmos 003 draft**\nBecause…"),
      "Delete Atmos 003 draft",
    );
  });

  test("gives nothing back for an empty answer", () => {
    assert.equal(cleanTitle("  \n "), null);
  });
});
