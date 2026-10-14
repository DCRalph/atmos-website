import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { formatDuration } from "./dates";

describe("formatDuration", () => {
  test("two units at most, dropping an empty second one", () => {
    assert.equal(formatDuration(0), "0s");
    assert.equal(formatDuration(45.4), "45s");
    assert.equal(formatDuration(80), "1m 20s");
    assert.equal(formatDuration(600), "10m");
    assert.equal(formatDuration(7500), "2h 5m");
    assert.equal(formatDuration(3 * 86400 + 2 * 3600 + 59), "3d 2h");
  });

  test("never negative", () => {
    assert.equal(formatDuration(-30), "0s");
  });
});
