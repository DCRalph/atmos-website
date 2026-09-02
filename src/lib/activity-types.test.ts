import { describe, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  ACTIVITY_TYPE_VALUES,
  activityTypeLabel,
  activityTypeTone,
} from "./activity-types";

/**
 * The members of `enum ActivityType` in the Prisma schema, read from the file
 * rather than imported: the point of the client-side copy is that client code
 * never pulls in the generated Prisma client, so this test cannot either.
 */
function schemaActivityTypes(): string[] {
  const schemaPath = fileURLToPath(
    new URL("../../prisma/schema.prisma", import.meta.url),
  );
  const body = /enum ActivityType \{([^}]*)\}/.exec(
    readFileSync(schemaPath, "utf8"),
  );
  assert.ok(body?.[1], "no ActivityType enum in the schema");
  return body[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[A-Z][A-Z0-9_]*$/.test(line));
}

describe("ActivityType", () => {
  // The activity log filters on this list and labels rows from it. When it fell
  // behind the schema, two thirds of the types were unfilterable and their rows
  // rendered the raw enum name as a badge.
  test("the client-safe copy matches the schema exactly", () => {
    assert.deepEqual(ACTIVITY_TYPE_VALUES, schemaActivityTypes());
  });
});

describe("activityTypeLabel", () => {
  test("reads as a sentence", () => {
    assert.equal(
      activityTypeLabel("TICKET_SCAN_OVERRIDE"),
      "Ticket scan override",
    );
    assert.equal(activityTypeLabel("LOGIN"), "Login");
  });
});

describe("activityTypeTone", () => {
  test("takes its cue from the verb", () => {
    assert.equal(activityTypeTone("GIG_DELETED"), "removed");
    assert.equal(activityTypeTone("GIG_CREATED"), "created");
    assert.equal(activityTypeTone("GIG_UPDATED"), "updated");
    assert.equal(activityTypeTone("LOGIN"), "neutral");
  });
});
