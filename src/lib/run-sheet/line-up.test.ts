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

/** Who is in a slot, keyed the way a name on the bill is keyed. */
const billed = (...names: [id: string, displayName: string][]) =>
  names.map(([id, displayName]) => ({
    id: `slot-${id}`,
    creatorProfile: profile(id, displayName),
  }));

/** A run sheet row carrying every internal field it can. */
function row(over: Partial<LineUpSource> = {}): LineUpSource {
  return {
    kind: "SET",
    role: null,
    startsAt: null,
    sortOrder: 0,
    artists: billed(["p-1", "Nova"]),
    ...over,
  };
}

const names = (lineUp: ReturnType<typeof toPublicLineUp>) =>
  lineUp.map((entry) => entry.creatorProfile.displayName);

describe("the public line-up", () => {
  test("has exactly the keys it is allowed to have", () => {
    const [entry] = toPublicLineUp([row()]);
    assert.ok(entry);
    assert.deepEqual(Object.keys(entry).sort(), [...PUBLIC_LINE_UP_KEYS].sort());
  });

  test("carries no times, however the row is timed", () => {
    const [entry] = toPublicLineUp([
      row({ startsAt: new Date("2026-03-14T09:00:00Z") }),
    ]);
    assert.equal(JSON.stringify(entry).includes("2026"), false);
  });

  test("leaves out everything that is not a set", () => {
    const lineUp = toPublicLineUp([
      row({ kind: "DOORS", artists: [] }),
      row({ kind: "SOUND_CHECK", artists: [] }),
      row({ kind: "SET", artists: billed(["p-9", "Kessler"]) }),
    ]);
    assert.deepEqual(names(lineUp), ["Kessler"]);
  });

  test("a back to back puts both names on the bill, in billing order", () => {
    const lineUp = toPublicLineUp([
      row({ artists: billed(["p-1", "Nova"], ["p-2", "Kessler"]) }),
    ]);
    assert.deepEqual(names(lineUp), ["Nova", "Kessler"]);
  });

  test("each name on the bill is its own entry, keyed by its own slot", () => {
    const lineUp = toPublicLineUp([
      row({ role: "Headliner", artists: billed(["p-1", "Nova"], ["p-2", "Kessler"]) }),
    ]);
    assert.deepEqual(
      lineUp.map((entry) => entry.id),
      ["slot-p-1", "slot-p-2"],
    );
    // The role belongs to the slot, so both names carry it.
    assert.deepEqual(
      lineUp.map((entry) => entry.role),
      ["Headliner", "Headliner"],
    );
  });

  test("an artist playing twice is one name, at their first slot", () => {
    const lineUp = toPublicLineUp([
      row({
        startsAt: new Date("2026-03-14T09:00:00Z"),
        artists: billed(["p-1", "Nova"]),
      }),
      row({
        startsAt: new Date("2026-03-14T10:00:00Z"),
        artists: billed(["p-2", "Kessler"]),
      }),
      row({
        startsAt: new Date("2026-03-14T11:00:00Z"),
        artists: billed(["p-1", "Nova"]),
      }),
    ]);
    assert.deepEqual(names(lineUp), ["Nova", "Kessler"]);
    assert.equal(lineUp[0]?.id, "slot-p-1");
  });

  test("somebody in a back to back and a solo slot is still one name", () => {
    const lineUp = toPublicLineUp([
      row({
        startsAt: new Date("2026-03-14T09:00:00Z"),
        artists: billed(["p-1", "Nova"], ["p-2", "Kessler"]),
      }),
      row({
        startsAt: new Date("2026-03-14T11:00:00Z"),
        artists: billed(["p-2", "Kessler"]),
      }),
    ]);
    assert.deepEqual(names(lineUp), ["Nova", "Kessler"]);
  });

  test("a bill with no times keeps the order it was dragged into", () => {
    const lineUp = toPublicLineUp([
      row({ sortOrder: 2, artists: billed(["p-3", "Third"]) }),
      row({ sortOrder: 0, artists: billed(["p-1", "First"]) }),
      row({ sortOrder: 1, artists: billed(["p-2", "Second"]) }),
    ]);
    assert.deepEqual(names(lineUp), ["First", "Second", "Third"]);
  });
});
