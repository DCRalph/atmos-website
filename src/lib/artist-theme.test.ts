import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import {
  DEFAULT_THEME,
  THEME_PRESETS,
  parseTheme,
  resolveTheme,
} from "./artist-theme";

describe("parseTheme", () => {
  test("keeps a valid theme and replaces only the bad fields", () => {
    const theme = THEME_PRESETS.flyer.theme;
    assert.deepEqual(parseTheme(theme), theme);
    assert.deepEqual(parseTheme({ ...theme, ground: "red", layout: "grid" }), {
      ...theme,
      ground: DEFAULT_THEME.ground,
      layout: DEFAULT_THEME.layout,
    });
  });

  test("maps themes saved under the old token model", () => {
    assert.deepEqual(
      parseTheme({
        pageBg: "#ffffff",
        accent: "#6366f1",
        headingFont: "serif",
        blockRadius: 12,
      }),
      {
        layout: "headliner",
        ground: "#ffffff",
        accent: "#6366f1",
        display: "bodoni",
        corners: "soft",
        photo: "color",
      },
    );
  });

  test("falls back to the default for anything unreadable", () => {
    assert.deepEqual(parseTheme(null), DEFAULT_THEME);
    assert.deepEqual(parseTheme("atmos"), DEFAULT_THEME);
  });
});

describe("resolveTheme", () => {
  // Every pick has to stay readable: text, text on the accent, accent as text.
  test("derives readable colours for light and dark grounds", () => {
    const dark = resolveTheme(THEME_PRESETS.atmos.theme);
    assert.equal(dark.tone, "dark");
    assert.equal(dark.ink, "#ffffff");
    assert.equal(dark.accentInk, "#000000");

    const light = resolveTheme(THEME_PRESETS.flyer.theme);
    assert.equal(light.tone, "light");
    assert.equal(light.ink, "#0a0a0a");
    assert.equal(light.accentInk, "#ffffff");
  });

  test("uses ink for accent text when the accent is too faint on the ground", () => {
    const t = resolveTheme({ ...DEFAULT_THEME, accent: "#111111" });
    assert.equal(t.accentText, t.ink);
  });

  test("lets the profile's own accent win", () => {
    assert.equal(resolveTheme(DEFAULT_THEME, "#ff4d1a").accent, "#ff4d1a");
    assert.equal(
      resolveTheme(DEFAULT_THEME, "nope").accent,
      DEFAULT_THEME.accent,
    );
  });
});
