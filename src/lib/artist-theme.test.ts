import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import {
  DEFAULT_THEME,
  NO_HISTORY,
  THEME_PRESETS,
  parseTheme,
  recordThemeChange,
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
        ...DEFAULT_THEME,
        ground: "#ffffff",
        groundTop: "#ffffff",
        accent: "#6366f1",
        display: "bodoni",
        case: "typed",
        radius: 16,
      },
    );
  });

  test("reads themes saved before the Type and Shape choices as they looked", () => {
    const before = {
      layout: "stage",
      style: "print",
      ground: "#3b0072",
      accent: "#c6ff33",
      display: "bodoni",
      corners: "soft",
      photo: "duotone",
    };
    assert.deepEqual(parseTheme(before), {
      layout: "stage",
      style: "print",
      ground: "#3b0072",
      background: "solid",
      groundTop: "#3b0072",
      texture: "none",
      accent: "#c6ff33",
      ink: null,
      tint: 0,
      display: "bodoni",
      case: "typed",
      nameSize: "fill",
      body: "archivo",
      radius: 16,
      buttons: "pill",
      density: "regular",
      outline: 2,
      photo: "duotone",
    });
    assert.equal(parseTheme({ ...before, corners: "hard" }).radius, 0);
  });

  test("reads themes saved before styles as glass", () => {
    const before: Record<string, unknown> = { ...THEME_PRESETS.flyer.theme };
    delete before.style;
    assert.equal(parseTheme(before).style, "glass");
    assert.equal(parseTheme({ ...before, style: "neon" }).style, "glass");
    assert.equal(parseTheme({ ...before, style: "flat" }).style, "flat");
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

  test("uses their own text colour only while it reads on the ground", () => {
    const warm = resolveTheme({ ...DEFAULT_THEME, ink: "#f4ede4" });
    assert.equal(warm.ink, "#f4ede4");
    const faint = resolveTheme({ ...DEFAULT_THEME, ink: "#333333" });
    assert.equal(faint.ink, "#ffffff");
  });

  test("lets the profile's own accent win", () => {
    assert.equal(resolveTheme(DEFAULT_THEME, "#ff4d1a").accent, "#ff4d1a");
    assert.equal(
      resolveTheme(DEFAULT_THEME, "nope").accent,
      DEFAULT_THEME.accent,
    );
  });
});

describe("recordThemeChange", () => {
  test("keeps a drag as one step, and separate changes as their own", () => {
    const a = DEFAULT_THEME;
    const b = { ...a, radius: 4 };
    const c = { ...a, radius: 8 };
    let h = recordThemeChange(NO_HISTORY, a, "radius", 1000);
    h = recordThemeChange(h, b, "radius", 1400);
    assert.deepEqual(h.past, [a]);
    h = recordThemeChange(h, c, "radius", 3000);
    h = recordThemeChange(h, a, undefined, 3100);
    h = recordThemeChange(h, a, undefined, 3200);
    assert.equal(h.past.length, 4);
  });
});
