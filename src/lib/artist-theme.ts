import { z } from "zod";
import type { CSSProperties } from "react";

/**
 * Artist profile themes.
 *
 * A theme is six choices: a layout and five looks. Everything else is
 * derived, so no combination an artist can pick ends up unreadable.
 *
 *  - layout:  how the page is put together (see `LAYOUTS`)
 *  - ground:  page colour
 *  - accent:  fills (buy buttons, calendar tiles, on now) and accent text
 *  - display: the face for their name and section headings
 *  - corners: hard (square panels, like the site) or soft (rounded panels)
 *  - photo:   how their own photos are treated. Gig posters are never touched.
 *
 * Stored as JSON in `ArtistProfileTheme.tokens`. Themes saved before this
 * model are read through `parseTheme`, which maps their old tokens across.
 */

export const LAYOUTS = {
  headliner: {
    label: "Headliner",
    description:
      "Photo and name up top with the next set counting down, the run beside it.",
  },
  wall: {
    label: "Wall",
    description:
      "Name edge to edge, then every set as a wall of posters by year.",
  },
  stage: {
    label: "Stage",
    description:
      "Portrait and big buttons on a phone, a press kit with tabs on desktop.",
  },
} as const;

export type LayoutKey = keyof typeof LAYOUTS;

/**
 * Display faces. `family` is the CSS variable next/font sets (site faces from
 * `~/lib/site-fonts`, the rest from `~/lib/artist-fonts`). `em` is the
 * face's average character width at display settings, so a name can be sized
 * to fill a width whatever face it's set in.
 */
export const FACES = {
  orbitron: {
    label: "Orbitron",
    family: "var(--font-site-heading)",
    stretch: "100%",
    weight: 900,
    upper: true,
    em: 0.82,
  },
  anybody: {
    label: "Anybody Wide",
    family: "var(--font-site-display)",
    stretch: "135%",
    weight: 800,
    upper: true,
    em: 0.94,
  },
  unbounded: {
    label: "Unbounded",
    family: "var(--font-artist-unbounded)",
    stretch: "100%",
    weight: 800,
    upper: true,
    em: 0.87,
  },
  shoulders: {
    label: "Big Shoulders",
    family: "var(--font-artist-shoulders)",
    stretch: "100%",
    weight: 900,
    upper: true,
    em: 0.49,
  },
  bodoni: {
    label: "Bodoni",
    family: "var(--font-artist-bodoni)",
    stretch: "100%",
    weight: 800,
    upper: false,
    em: 0.62,
  },
} as const;

export type FaceKey = keyof typeof FACES;

const zHex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a #rrggbb colour");

export const zArtistTheme = z.object({
  layout: z.enum(["headliner", "wall", "stage"]),
  ground: zHex,
  accent: zHex,
  display: z.enum(["orbitron", "anybody", "unbounded", "shoulders", "bodoni"]),
  corners: z.enum(["hard", "soft"]),
  photo: z.enum(["color", "mono", "duotone"]),
});

export type ArtistTheme = z.infer<typeof zArtistTheme>;
export type Corners = ArtistTheme["corners"];
export type PhotoTreatment = ArtistTheme["photo"];

/** Starter themes. `bun run db:seed-themes` keeps a system theme for each. */
export const THEME_PRESETS = {
  atmos: {
    name: "Atmos",
    description: "True black, acid accent, Orbitron. The site's own look.",
    theme: {
      layout: "headliner",
      ground: "#000000",
      accent: "#c6ff33",
      display: "orbitron",
      corners: "hard",
      photo: "color",
    },
  },
  ultraviolet: {
    name: "Ultraviolet",
    description: "Violet black with magenta duotone photos.",
    theme: {
      layout: "wall",
      ground: "#08020f",
      accent: "#ff2fd4",
      display: "unbounded",
      corners: "soft",
      photo: "duotone",
    },
  },
  gold: {
    name: "Gold",
    description: "Near black and gold, wide caps, soft corners.",
    theme: {
      layout: "headliner",
      ground: "#0a0a0a",
      accent: "#ffc21a",
      display: "anybody",
      corners: "soft",
      photo: "color",
    },
  },
  ice: {
    name: "Ice",
    description: "Cold blue on black, tall condensed type, mono photos.",
    theme: {
      layout: "wall",
      ground: "#020a10",
      accent: "#5ee0ff",
      display: "shoulders",
      corners: "hard",
      photo: "mono",
    },
  },
  flyer: {
    name: "Flyer",
    description: "Light grey and electric blue, like a printed flyer.",
    theme: {
      layout: "stage",
      ground: "#efefec",
      accent: "#2335ff",
      display: "anybody",
      corners: "hard",
      photo: "mono",
    },
  },
  heritage: {
    name: "Heritage",
    description: "Atmos purple drenched, Bodoni name, acid duotone.",
    theme: {
      layout: "stage",
      ground: "#3b0072",
      accent: "#c6ff33",
      display: "bodoni",
      corners: "soft",
      photo: "duotone",
    },
  },
} as const satisfies Record<
  string,
  { name: string; description: string; theme: ArtistTheme }
>;

export const DEFAULT_THEME: ArtistTheme = THEME_PRESETS.atmos.theme;

/** Swatches offered in the theme editor; any colour works too. */
export const GROUND_SWATCHES = [
  "#000000",
  "#0a0a0a",
  "#08020f",
  "#020a10",
  "#3b0072",
  "#0d2b1d",
  "#5a0a0a",
  "#efefec",
] as const;

export const ACCENT_SWATCHES = [
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
// Parsing

const isHex = (v: unknown): v is string =>
  typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);

/** Old `headingFont` values, mapped to the nearest face. */
const LEGACY_FACES: Record<string, FaceKey> = {
  serif: "bodoni",
  display: "shoulders",
  mono: "orbitron",
  handwritten: "unbounded",
  sans: "orbitron",
  inherit: "orbitron",
};

/**
 * Read a stored theme. Current themes are validated field by field, so one
 * bad value falls back alone rather than taking the theme with it. Themes
 * saved under the old token model (`pageBg`, `headingFont`, `blockRadius`...)
 * are mapped across.
 */
export function parseTheme(raw: unknown): ArtistTheme {
  if (!raw || typeof raw !== "object") return DEFAULT_THEME;
  const r = raw as Record<string, unknown>;

  if (!("layout" in r) && ("pageBg" in r || "blockBg" in r)) {
    return {
      layout: "headliner",
      ground: isHex(r.pageBg) ? r.pageBg : DEFAULT_THEME.ground,
      accent: isHex(r.accent) ? r.accent : DEFAULT_THEME.accent,
      display:
        typeof r.headingFont === "string"
          ? (LEGACY_FACES[r.headingFont] ?? DEFAULT_THEME.display)
          : DEFAULT_THEME.display,
      corners:
        typeof r.blockRadius === "number" && r.blockRadius >= 8
          ? "soft"
          : "hard",
      photo: "color",
    };
  }

  const shape = zArtistTheme.shape;
  const field = <K extends keyof ArtistTheme>(key: K): ArtistTheme[K] => {
    const parsed = shape[key].safeParse(r[key]);
    return parsed.success
      ? (parsed.data as ArtistTheme[K])
      : DEFAULT_THEME[key];
  };
  return {
    layout: field("layout"),
    ground: field("ground"),
    accent: field("accent"),
    display: field("display"),
    corners: field("corners"),
    photo: field("photo"),
  };
}

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

/** WCAG contrast ratio between two `#rrggbb` colours. */
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

// ---------------------------------------------------------------------------
// Resolving

export type ResolvedTheme = ArtistTheme & {
  tone: "dark" | "light";
  ink: string;
  accentInk: string;
  /** The accent where it's used as text on the ground; ink when too faint. */
  accentText: string;
};

/**
 * Derive the colours a theme doesn't store. `accentOverride` is the
 * profile's own accent (`ArtistProfile.accentColor`), which wins over the
 * theme's.
 */
export function resolveTheme(
  theme: ArtistTheme,
  accentOverride?: string | null,
): ResolvedTheme {
  const accent = isHex(accentOverride) ? accentOverride : theme.accent;
  const tone = luminance(theme.ground) > 0.36 ? "light" : "dark";
  const ink = tone === "light" ? "#0a0a0a" : "#ffffff";
  const accentInk =
    contrast(accent, "#000000") >= contrast(accent, "#ffffff")
      ? "#000000"
      : "#ffffff";
  const accentText = contrast(accent, theme.ground) >= 3 ? accent : ink;
  return { ...theme, accent, tone, ink, accentInk, accentText };
}

/**
 * Every `--cp-*` variable for a theme, plus the site accent so shared site
 * parts (buttons, the on-now panel, the cart) follow it. Set on the profile's
 * root next to `data-tone`, `data-photo` and `data-corners`; see
 * `src/styles/artist-profile.css`.
 */
export function themeVars(t: ResolvedTheme): CSSProperties {
  const face = FACES[t.display];
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

/** The data attributes `artist-profile.css` keys off, for the same root. */
export const themeAttributes = (t: ResolvedTheme) => ({
  "data-tone": t.tone,
  "data-photo": t.photo,
  "data-corners": t.corners,
});
