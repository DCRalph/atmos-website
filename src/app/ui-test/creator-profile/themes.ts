import type { CSSProperties } from "react";

/**
 * Proposed creator theme model: five choices a creator makes, everything else
 * derived. Text colours come from the ground and the accent, so no
 * combination a creator can pick ends up unreadable.
 *
 *  - ground:  page colour
 *  - accent:  fills (buy buttons, calendar tiles, on now) and accent text
 *  - display: the face for their name and section headings
 *  - corners: hard (square panels, like the site) or soft (16px panels)
 *  - photo:   how their own photos are treated. Gig posters are never touched.
 *
 * Buttons stay pills and labels stay on the site's stretched Anybody in every
 * theme, so a themed profile still reads as part of Atmos.
 *
 * Each face carries `em`, its average character width at display settings,
 * so a name can be sized to fill a width whatever face it's set in.
 */
export const faces = {
  orbitron: {
    em: 0.82,
    label: "Orbitron",
    family: "var(--font-site-heading)",
    stretch: "100%",
    weight: 900,
    upper: true,
  },
  anybody: {
    em: 0.94,
    label: "Anybody Wide",
    family: "var(--font-site-display)",
    stretch: "135%",
    weight: 800,
    upper: true,
  },
  unbounded: {
    em: 0.87,
    label: "Unbounded",
    family: "var(--font-cp-unbounded)",
    stretch: "100%",
    weight: 800,
    upper: true,
  },
  shoulders: {
    em: 0.49,
    label: "Big Shoulders",
    family: "var(--font-cp-shoulders)",
    stretch: "100%",
    weight: 900,
    upper: true,
  },
  bodoni: {
    em: 0.56,
    label: "Bodoni",
    family: "var(--font-cp-bodoni)",
    stretch: "100%",
    weight: 800,
    upper: false,
  },
} as const;

export type FaceKey = keyof typeof faces;
export type Corners = "hard" | "soft";
export type PhotoTreatment = "color" | "mono" | "duotone";

export type ThemeChoice = {
  ground: string;
  accent: string;
  display: FaceKey;
  corners: Corners;
  photo: PhotoTreatment;
};

export const presets = {
  atmos: {
    name: "Atmos",
    ground: "#000000",
    accent: "#c6ff33",
    display: "orbitron",
    corners: "hard",
    photo: "color",
  },
  ultraviolet: {
    name: "Ultraviolet",
    ground: "#08020f",
    accent: "#ff2fd4",
    display: "unbounded",
    corners: "soft",
    photo: "duotone",
  },
  gold: {
    name: "Gold",
    ground: "#0a0a0a",
    accent: "#ffc21a",
    display: "anybody",
    corners: "soft",
    photo: "color",
  },
  ice: {
    name: "Ice",
    ground: "#020a10",
    accent: "#5ee0ff",
    display: "shoulders",
    corners: "hard",
    photo: "mono",
  },
  flyer: {
    name: "Flyer",
    ground: "#efefec",
    accent: "#2335ff",
    display: "anybody",
    corners: "hard",
    photo: "mono",
  },
  heritage: {
    name: "Heritage",
    ground: "#3b0072",
    accent: "#c6ff33",
    display: "bodoni",
    corners: "soft",
    photo: "duotone",
  },
} as const satisfies Record<string, ThemeChoice & { name: string }>;

export type PresetKey = keyof typeof presets;

/** Swatches offered in the customise panel; any hex works too. */
export const groundSwatches = [
  "#000000",
  "#0a0a0a",
  "#08020f",
  "#020a10",
  "#3b0072",
  "#0d2b1d",
  "#5a0a0a",
  "#efefec",
] as const;

export const accentSwatches = [
  "#c6ff33",
  "#ff2fd4",
  "#ffc21a",
  "#5ee0ff",
  "#2335ff",
  "#ff4d1a",
  "#ffffff",
  "#8a3ffc",
] as const;

// ---------------------------------------------------------------------------
// Contrast

const channel = (hex: string, i: number) => {
  const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance of a `#rrggbb` colour. */
export const luminance = (hex: string) =>
  0.2126 * channel(hex, 0) +
  0.7152 * channel(hex, 1) +
  0.0722 * channel(hex, 2);

export const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
};

export const isHex = (v: string | undefined): v is string =>
  !!v && /^#[0-9a-f]{6}$/i.test(v);

// ---------------------------------------------------------------------------
// Resolve

export type ResolvedTheme = ThemeChoice & {
  tone: "dark" | "light";
  ink: string;
  accentInk: string;
  /** The accent where it's used as text on the ground; ink when too faint. */
  accentText: string;
};

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  const tone = luminance(choice.ground) > 0.36 ? "light" : "dark";
  const ink = tone === "light" ? "#0a0a0a" : "#ffffff";
  const accentInk =
    contrast(choice.accent, "#000000") >= contrast(choice.accent, "#ffffff")
      ? "#000000"
      : "#ffffff";
  const accentText =
    contrast(choice.accent, choice.ground) >= 3 ? choice.accent : ink;
  return { ...choice, tone, ink, accentInk, accentText };
}

/** Every `--cp-*` variable for a theme, plus the site accent so shared site parts follow it. */
export function themeVars(t: ResolvedTheme): CSSProperties {
  const face = faces[t.display];
  const mix = (pct: number) =>
    `color-mix(in oklab, ${t.ink} ${pct}%, transparent)`;
  return {
    "--cp-ground": t.ground,
    "--cp-raised": `color-mix(in oklab, ${t.ground}, ${t.ink} 5%)`,
    "--cp-ink": t.ink,
    "--cp-muted": mix(66),
    "--cp-faint": mix(46),
    "--cp-line": mix(13),
    "--cp-line-soft": mix(7),
    "--cp-accent": t.accent,
    "--cp-accent-ink": t.accentInk,
    "--cp-accent-text": t.accentText,
    "--cp-display-font": face.family,
    "--cp-display-stretch": face.stretch,
    "--cp-display-weight": face.weight,
    "--cp-display-case": face.upper ? "uppercase" : "none",
    "--cp-display-em": face.em,
    "--cp-r-panel": t.corners === "soft" ? "16px" : "0px",
    "--cp-r-media": t.corners === "soft" ? "10px" : "0px",
    "--site-accent": t.accent,
    "--site-accent-ink": t.accentInk,
    "--site-accent-text": t.accentText,
  } as CSSProperties;
}
