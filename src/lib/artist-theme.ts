import { z } from "zod";
import type { CSSProperties } from "react";
import { SITE_ACCENT } from "./site-constants";

/**
 * Artist profile themes.
 *
 * A theme is a layout plus a set of looks. Everything else is derived, so no
 * combination an artist can pick ends up unreadable.
 *
 *  - layout:      how the page is put together (see `LAYOUTS`)
 *  - style:       how tiles and controls are drawn (see `STYLES`)
 *  - ground:      page colour. `background` adds a gradient from `groundTop`
 *                 or their banner photo behind it, `texture` a grain or dots.
 *  - accent:      fills (buy buttons, calendar tiles, on now) and accent text
 *  - ink:         their own text colour, or null for black or white. Used only
 *                 while it reads on the ground (see `resolveTheme`).
 *  - tint:        how much of the accent tiles take on, 0 to 20 (%)
 *  - display:     the face for their name and headings, `case` how it's set,
 *                 `nameSize` how big their name gets
 *  - body:        the face for everything else on their page
 *  - radius:      corners of tiles and photos, 0 to 32 (px)
 *  - buttons:     the shape of buttons and chips
 *  - density:     the space between tiles and inside them
 *  - outline:     Print's ink weight, 1 to 3 (px)
 *  - photo:       how their own photos are treated. Gig posters are never touched.
 *
 * Stored as JSON in `ArtistProfileTheme.tokens`. Themes saved before a field
 * existed are read through `parseTheme`, which fills it in so they look the
 * same as they did.
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
  reel: {
    label: "Reel",
    description:
      "The page scrolls sideways, column by column. Swipe cards on a phone.",
  },
} as const;

export type LayoutKey = keyof typeof LAYOUTS;

/**
 * How the grid's tiles, the header's sets strip, chips and buttons are drawn.
 * Colours, face and corners still come from the rest of the theme; see
 * `[data-style]` in `src/styles/artist-profile.css`.
 */
export const STYLES = {
  glass: {
    label: "Glass",
    description: "Frosted glass over light from the header.",
  },
  flat: {
    label: "Flat",
    description: "Solid surfaces. No edges, no shadows.",
  },
  print: {
    label: "Print",
    description: "Ink outlines and a hard offset shadow.",
  },
} as const;

export type StyleKey = keyof typeof STYLES;

/**
 * Display faces, in the groups the editor shows them in. `family` is the CSS
 * variable next/font sets (site faces from `~/lib/site-fonts`, the rest from
 * `~/lib/artist-fonts`). `upper` is the case a face starts in. `em` is the
 * face's average character width at display settings (measured over a set of
 * artist names, plus a little room), so a name can be sized to fill a width
 * whatever face it's set in.
 */
export const FACES = {
  orbitron: face("Orbitron", "Wide", "var(--font-site-heading)", 900, 0.82, {}),
  anybody: face("Anybody Wide", "Wide", "var(--font-site-display)", 800, 0.94, {
    stretch: "135%",
  }),
  unbounded: face(
    "Unbounded",
    "Wide",
    "var(--font-artist-unbounded)",
    800,
    0.87,
    {},
  ),
  syne: face("Syne", "Wide", "var(--font-artist-syne)", 800, 1.17, {}),
  shoulders: face(
    "Big Shoulders",
    "Condensed",
    "var(--font-artist-shoulders)",
    900,
    0.49,
    {},
  ),
  anton: face("Anton", "Condensed", "var(--font-artist-anton)", 400, 0.48, {}),
  bebas: face(
    "Bebas Neue",
    "Condensed",
    "var(--font-artist-bebas)",
    400,
    0.39,
    {},
  ),
  bodoni: face("Bodoni", "Serif", "var(--font-artist-bodoni)", 800, 0.62, {
    upper: false,
  }),
  playfair: face(
    "Playfair",
    "Serif",
    "var(--font-artist-playfair)",
    900,
    0.57,
    { upper: false },
  ),
  dmserif: face("DM Serif", "Serif", "var(--font-artist-dmserif)", 400, 0.53, {
    upper: false,
  }),
  spacemono: face(
    "Space Mono",
    "Mono",
    "var(--font-artist-spacemono)",
    700,
    0.64,
    {},
  ),
  jetbrains: face(
    "JetBrains Mono",
    "Mono",
    "var(--font-artist-jetbrains)",
    800,
    0.63,
    {},
  ),
  archivoblack: face(
    "Archivo Black",
    "Grotesk",
    "var(--font-artist-archivoblack)",
    400,
    0.77,
    {},
  ),
  bricolage: face(
    "Bricolage",
    "Grotesk",
    "var(--font-artist-bricolage)",
    800,
    0.67,
    {},
  ),
  rubikmono: face(
    "Rubik Mono",
    "Rounded",
    "var(--font-artist-rubikmono)",
    400,
    0.89,
    {},
  ),
  shrikhand: face(
    "Shrikhand",
    "Script",
    "var(--font-artist-shrikhand)",
    400,
    0.64,
    { upper: false },
  ),
};

function face<const G extends string>(
  label: string,
  group: G,
  family: string,
  weight: number,
  em: number,
  { stretch = "100%", upper = true }: { stretch?: string; upper?: boolean },
) {
  return { label, group, family, weight, em, stretch, upper };
}

export type FaceKey = keyof typeof FACES;

/** Faces for body text. Archivo is the rest of the site's. */
export const BODIES = {
  archivo: {
    label: "Archivo",
    note: "The site's own",
    family: "var(--font-site-body)",
  },
  grotesk: {
    label: "Space Grotesk",
    note: "Techy, a little quirky",
    family: "var(--font-artist-grotesk)",
  },
  inter: {
    label: "Inter Tight",
    note: "Neutral and compact",
    family: "var(--font-artist-inter)",
  },
  plex: {
    label: "IBM Plex Mono",
    note: "Typewriter",
    family: "var(--font-artist-plex)",
  },
  newsreader: {
    label: "Newsreader",
    note: "Bookish serif",
    family: "var(--font-artist-newsreader)",
  },
} as const;

export type BodyKey = keyof typeof BODIES;

const keys = <T extends object>(o: T) =>
  Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

const zHex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a #rrggbb colour");

export const zArtistTheme = z.object({
  layout: z.enum(keys(LAYOUTS)),
  style: z.enum(keys(STYLES)),
  ground: zHex,
  background: z.enum(["solid", "gradient", "photo"]),
  /** The gradient's top colour. */
  groundTop: zHex,
  texture: z.enum(["none", "grain", "halftone"]),
  accent: zHex,
  ink: zHex.nullable(),
  tint: z.number().int().min(0).max(20),
  display: z.enum(keys(FACES)),
  case: z.enum(["upper", "typed"]),
  nameSize: z.enum(["fill", "large", "medium"]),
  body: z.enum(keys(BODIES)),
  radius: z.number().int().min(0).max(32),
  buttons: z.enum(["pill", "rounded", "square"]),
  density: z.enum(["compact", "regular", "airy"]),
  outline: z.number().int().min(1).max(3),
  photo: z.enum(["color", "mono", "duotone"]),
});

export type ArtistTheme = z.infer<typeof zArtistTheme>;
export type TileStyle = ArtistTheme["style"];
export type PhotoTreatment = ArtistTheme["photo"];

/** Everything a starter doesn't pick for itself: how the page looked before these were choices. */
const PLAIN = {
  background: "solid",
  texture: "none",
  ink: null,
  tint: 0,
  case: "upper",
  nameSize: "fill",
  body: "archivo",
  buttons: "pill",
  density: "regular",
  outline: 2,
} as const;

/** Starter themes. `bun run db:seed-themes` keeps a system theme for each. */
export const THEME_PRESETS = {
  atmos: {
    name: "Atmos",
    description: "True black, acid accent, Orbitron. The site's own look.",
    theme: {
      ...PLAIN,
      layout: "headliner",
      style: "glass",
      ground: "#000000",
      groundTop: "#000000",
      accent: SITE_ACCENT,
      display: "orbitron",
      radius: 0,
      photo: "color",
    },
  },
  ultraviolet: {
    name: "Ultraviolet",
    description: "Violet black with magenta duotone photos.",
    theme: {
      ...PLAIN,
      layout: "wall",
      style: "glass",
      ground: "#08020f",
      groundTop: "#08020f",
      accent: "#ff2fd4",
      display: "unbounded",
      radius: 16,
      photo: "duotone",
    },
  },
  gold: {
    name: "Gold",
    description: "Near black and gold, wide caps, soft corners.",
    theme: {
      ...PLAIN,
      layout: "headliner",
      style: "flat",
      ground: "#0a0a0a",
      groundTop: "#0a0a0a",
      accent: "#ffc21a",
      display: "anybody",
      radius: 16,
      photo: "color",
    },
  },
  ice: {
    name: "Ice",
    description: "Cold blue on black, tall condensed type, mono photos.",
    theme: {
      ...PLAIN,
      layout: "wall",
      style: "flat",
      ground: "#020a10",
      groundTop: "#020a10",
      accent: "#5ee0ff",
      display: "shoulders",
      radius: 0,
      photo: "mono",
    },
  },
  flyer: {
    name: "Flyer",
    description: "Light grey and electric blue, like a printed flyer.",
    theme: {
      ...PLAIN,
      layout: "stage",
      style: "print",
      ground: "#efefec",
      groundTop: "#efefec",
      accent: "#2335ff",
      display: "anybody",
      radius: 0,
      photo: "mono",
    },
  },
  heritage: {
    name: "Heritage",
    description: "Atmos purple drenched, Bodoni name, acid duotone.",
    theme: {
      ...PLAIN,
      layout: "stage",
      style: "print",
      ground: "#3b0072",
      groundTop: "#3b0072",
      accent: SITE_ACCENT,
      display: "bodoni",
      case: "typed",
      radius: 16,
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
  SITE_ACCENT,
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
 * bad value falls back alone rather than taking the theme with it, and a
 * field saved before it existed comes out as the page looked then (Hard and
 * Soft corners become 0 and 16, the case follows the face). Themes saved
 * under the old token model (`pageBg`, `headingFont`, `blockRadius`...) are
 * mapped across.
 */
export function parseTheme(raw: unknown): ArtistTheme {
  if (!raw || typeof raw !== "object") return DEFAULT_THEME;
  const r = raw as Record<string, unknown>;

  if (!("layout" in r) && ("pageBg" in r || "blockBg" in r)) {
    const ground = isHex(r.pageBg) ? r.pageBg : DEFAULT_THEME.ground;
    const display =
      typeof r.headingFont === "string"
        ? (LEGACY_FACES[r.headingFont] ?? DEFAULT_THEME.display)
        : DEFAULT_THEME.display;
    return {
      ...DEFAULT_THEME,
      ground,
      groundTop: ground,
      accent: isHex(r.accent) ? r.accent : DEFAULT_THEME.accent,
      display,
      case: FACES[display].upper ? "upper" : "typed",
      radius: typeof r.blockRadius === "number" && r.blockRadius >= 8 ? 16 : 0,
    };
  }

  const shape = zArtistTheme.shape;
  const field = <K extends keyof ArtistTheme>(
    key: K,
    fallback: ArtistTheme[K] = DEFAULT_THEME[key],
  ): ArtistTheme[K] => {
    const parsed = shape[key].safeParse(r[key]);
    return parsed.success ? (parsed.data as ArtistTheme[K]) : fallback;
  };
  const ground = field("ground");
  const display = field("display");
  return {
    layout: field("layout"),
    style: field("style"),
    ground,
    background: field("background"),
    groundTop: field("groundTop", ground),
    texture: field("texture"),
    accent: field("accent"),
    ink: field("ink"),
    tint: field("tint"),
    display,
    case: field("case", FACES[display].upper ? "upper" : "typed"),
    nameSize: field("nameSize"),
    body: field("body"),
    radius: field("radius", r.corners === "soft" ? 16 : 0),
    buttons: field("buttons"),
    density: field("density"),
    outline: field("outline"),
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
  /** The text colour in use: theirs when it reads on the ground, else black or white. */
  ink: string;
  accentInk: string;
  /** The accent where it's used as text on the ground; ink when too faint. */
  accentText: string;
};

/** Text has to reach this contrast on the ground (WCAG AA for body text). */
export const MIN_TEXT_CONTRAST = 4.5;

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
  const ink =
    theme.ink && contrast(theme.ink, theme.ground) >= MIN_TEXT_CONTRAST
      ? theme.ink
      : tone === "light"
        ? "#0a0a0a"
        : "#ffffff";
  const accentInk =
    contrast(accent, "#000000") >= contrast(accent, "#ffffff")
      ? "#000000"
      : "#ffffff";
  const accentText = contrast(accent, theme.ground) >= 3 ? accent : ink;
  return { ...theme, accent, tone, ink, accentInk, accentText };
}

const BUTTON_RADIUS = { pill: "999px", rounded: "10px", square: "0px" };

/** Largest a name gets at each `nameSize`. Fill is the layout's own size. */
const NAME_CAP = { fill: "99rem", large: "5.5rem", medium: "3.75rem" };

/**
 * Every `--cp-*` variable for a theme, plus the site accent so shared site
 * parts (buttons, the on-now panel, the cart) follow it. Set on the profile's
 * root next to the `themeAttributes`; see `src/styles/artist-profile.css`.
 */
export function themeVars(t: ResolvedTheme): CSSProperties {
  const face = FACES[t.display];
  const mix = (pct: number) =>
    `color-mix(in oklab, ${t.ink} ${pct}%, transparent)`;
  return {
    "--cp-ground": t.ground,
    "--cp-ground-top": t.background === "gradient" ? t.groundTop : t.ground,
    "--cp-raised": `color-mix(in oklab, ${t.ground}, ${t.ink} 5%)`,
    "--cp-ink": t.ink,
    "--cp-muted": mix(66),
    "--cp-faint": mix(46),
    "--cp-line": mix(13),
    "--cp-line-soft": mix(7),
    "--cp-accent": t.accent,
    "--cp-accent-ink": t.accentInk,
    "--cp-accent-text": t.accentText,
    "--cp-tint": `color-mix(in oklab, ${t.accent} ${t.tint}%, transparent)`,
    "--cp-display-font": face.family,
    "--cp-display-stretch": face.stretch,
    "--cp-display-weight": face.weight,
    "--cp-display-case": t.case === "upper" ? "uppercase" : "none",
    "--cp-display-em": face.em,
    "--cp-name-cap": NAME_CAP[t.nameSize],
    "--cp-body-font": BODIES[t.body].family,
    "--cp-r-panel": `${t.radius}px`,
    "--cp-r-media": `${Math.round(t.radius * 0.6)}px`,
    "--cp-r-button": BUTTON_RADIUS[t.buttons],
    "--cp-outline": `${t.outline}px`,
    "--site-accent": t.accent,
    "--site-accent-ink": t.accentInk,
    "--site-accent-text": t.accentText,
  } as CSSProperties;
}

/** The data attributes `artist-profile.css` keys off, for the same root. */
export const themeAttributes = (t: ResolvedTheme) => ({
  "data-tone": t.tone,
  "data-photo": t.photo,
  "data-style": t.style,
  "data-density": t.density,
  "data-bg": t.background,
  "data-texture": t.texture,
});

// ---------------------------------------------------------------------------
// Undo

/**
 * Undo for theme changes: the theme each change replaced, newest last.
 * Changes with the same `group` less than a second apart (dragging a slider
 * or a colour picker, typing a hex) are kept as one.
 */
export type ThemeHistory = {
  past: ArtistTheme[];
  group: string | null;
  at: number;
};

export const NO_HISTORY: ThemeHistory = { past: [], group: null, at: 0 };

/** `history` after a change from `prev`. */
export function recordThemeChange(
  history: ThemeHistory,
  prev: ArtistTheme,
  group?: string,
  now = Date.now(),
): ThemeHistory {
  const joins =
    group !== undefined && history.group === group && now - history.at < 1000;
  return {
    past: joins ? history.past : [...history.past, prev].slice(-50),
    group: group ?? null,
    at: now,
  };
}
