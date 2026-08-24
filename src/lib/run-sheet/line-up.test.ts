import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import {
  PUBLIC_LINE_UP_KEYS,
  toPublicLineUp,
  type LineUpSource,
} from "./line-up";

const profile = (id: string, displayName: string) => ({
  id,
  handle: displayName.toLowerCase(),
  displayName,
  avatarFileId: null,
  tagline: null,
  isPublished: true,
  claimStatus: "ACTIVE",
});

/** A run sheet row carrying every internal field it can. */
function row(over: Partial<LineUpSource> & { id: string }): LineUpSource {
  return {
    kind: "SET",
    role: null,
    startsAt: null,
    sortOrder: 0,
    creatorProfile: profile("p-1", "Nova"),
    ...over,
  };
}

describe("the public line-up", () => {
  test("has exactly the keys it is allowed to have", () => {
    const [entry] = toPublicLineUp([row({ id: "a" })]);
    assert.ok(entry);
    assert.deepEqual(Object.keys(entry).sort(), [...PUBLIC_LINE_UP_KEYS].sort());
  });

  test("carries no times, however the row is timed", () => {
    const [entry] = toPublicLineUp([
      row({ id: "a", startsAt: new Date("2026-03-14T09:00:00Z") }),
    ]);
    assert.equal(JSON.stringify(entry).includes("2026"), false);
  });

  test("leaves out everything that is not a set", () => {
    const lineUp = toPublicLineUp([
      row({ id: "doors", kind: "DOORS", creatorProfile: null }),
      row({ id: "check", kind: "SOUND_CHECK", creatorProfile: null }),
      row({ id: "set", kind: "SET" }),
    ]);
    assert.deepEqual(
      lineUp.map((entry) => entry.id),
      ["set"],
    );
  });

  test("an artist playing twice is one name, at their first slot", () => {
    const lineUp = toPublicLineUp([
      row({
        id: "open",
        startsAt: new Date("2026-03-14T09:00:00Z"),
        creatorProfile: profile("p-1", "Nova"),
      }),
      row({
        id: "middle",
        startsAt: new Date("2026-03-14T10:00:00Z"),
        creatorProfile: profile("p-2", "Kessler"),
      }),
      row({
        id: "close",
        startsAt: new Date("2026-03-14T11:00:00Z"),
        creatorProfile: profile("p-1", "Nova"),
      }),
    ]);
    assert.deepEqual(
      lineUp.map((entry) => entry.creatorProfile.displayName),
      ["Nova", "Kessler"],
    );
    assert.equal(lineUp[0]?.id, "open");
  });

  test("a bill with no times keeps the order it was dragged into", () => {
    const lineUp = toPublicLineUp([
      row({ id: "c", sortOrder: 2, creatorProfile: profile("p-3", "Third") }),
      row({ id: "a", sortOrder: 0, creatorProfile: profile("p-1", "First") }),
      row({ id: "b", sortOrder: 1, creatorProfile: profile("p-2", "Second") }),
    ]);
    assert.deepEqual(
      lineUp.map((entry) => entry.creatorProfile.displayName),
      ["First", "Second", "Third"],
    );
  });
});
