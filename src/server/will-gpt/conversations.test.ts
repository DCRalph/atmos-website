import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { cleanTitle, readMessages } from "./conversations";

test("stored transcripts retain request IDs and still read older messages", () => {
  const messages = [
    { role: "user", text: "An older message" },
    { role: "user", id: crypto.randomUUID(), text: "A recoverable submission" },
  ];
  assert.deepEqual(readMessages(messages), messages);
});

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
