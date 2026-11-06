import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { paletteFrom } from "./artist-palette";
import { contrast, luminance } from "./artist-theme";

/** RGBA pixels: `n` of each colour. */
const pixels = (...runs: [number, [number, number, number]][]) =>
  runs.flatMap(([n, [r, g, b]]) =>
    Array.from({ length: n }, () => [r, g, b, 255]).flat(),
  );

describe("paletteFrom", () => {
  test("takes a poster's colour as the accent, on a dark ground of the same hue", () => {
    // Mostly black with a red figure and a little white type.
    const p = paletteFrom(
      pixels([700, [8, 8, 8]], [250, [220, 30, 40]], [50, [250, 250, 250]]),
    );
    const [r, g, b] = [1, 3, 5].map((i) =>
      parseInt(p.accent.slice(i, i + 2), 16),
    );
    assert.ok(r! > g! * 2 && r! > b! * 2, `red accent, got ${p.accent}`);
    assert.ok(luminance(p.ground) < 0.01, `dark ground, got ${p.ground}`);
    assert.ok(contrast(p.accent, p.ground) >= 4);
  });

  test("a grey photo gives white on near black", () => {
    const p = paletteFrom(pixels([500, [40, 40, 40]], [500, [200, 200, 200]]));
    assert.equal(p.accent, "#ffffff");
  });
});
