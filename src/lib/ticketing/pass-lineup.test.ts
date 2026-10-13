import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { lineupFromRunSheet } from "./pass-lineup";

const artist = (displayName: string) => ({ artistProfile: { displayName } });
const at = (iso: string) => new Date(iso);

describe("lineupFromRunSheet", () => {
  test("sets run in time order and each performer is named once", () => {
    const lineup = lineupFromRunSheet([
      {
        label: null,
        startsAt: at("2026-08-14T12:45:00Z"),
        sortOrder: 0,
        artists: [artist("Kōtuku")],
      },
      {
        label: null,
        startsAt: at("2026-08-14T10:30:00Z"),
        sortOrder: 1,
        artists: [artist("DJ Harbour")],
      },
      {
        label: null,
        startsAt: at("2026-08-14T11:30:00Z"),
        sortOrder: 2,
        artists: [artist("Lo-Fi Lena"), artist("DJ Harbour")],
      },
    ]);

    assert.deepEqual(lineup.performers, ["DJ Harbour", "Lo-Fi Lena", "Kōtuku"]);
    assert.deepEqual(
      lineup.sets.map((set) => set.name),
      ["DJ Harbour", "Lo-Fi Lena b2b DJ Harbour", "Kōtuku"],
    );
  });

  test("a label beats the billing, and a set with neither is left out", () => {
    const lineup = lineupFromRunSheet([
      { label: "Secret guest", startsAt: null, sortOrder: 1, artists: [] },
      { label: "  ", startsAt: null, sortOrder: 0, artists: [] },
    ]);
    assert.deepEqual(lineup.sets, [{ name: "Secret guest", startsAt: null }]);
    assert.deepEqual(lineup.performers, []);
  });
});
