/**
 * Atmos, natively.
 *
 * Black ground and white type, as on the site. The door palette is kept
 * separate and deliberately loud: those colours are read at arm's length in a
 * dark room by somebody deciding whether to let a stranger in, so they are the
 * same signal colours the web scanner already uses rather than a softer set.
 */

export const colors = {
  bg: "#000000",
  surface: "#0E0E0E",
  surfaceRaised: "#171717",
  border: "#242424",
  borderStrong: "#333333",
  /** The hairline the site draws its brutalist edges in — `border-white/30`. */
  borderHard: "rgba(255,255,255,0.30)",

  text: "#FFFFFF",
  textSoft: "rgba(255,255,255,0.62)",
  textFaint: "rgba(255,255,255,0.38)",

  /** `--accent-strong` / `--accent-muted` from the site's globals.css. */
  accent: "#470082",
  accentMuted: "#483195",

  /** Door signal colours — admitted / exception / refused. */
  in: "#34D399",
  inDim: "rgba(52,211,153,0.12)",
  warn: "#F5A524",
  warnDim: "rgba(245,165,36,0.12)",
  deny: "#EF4444",
  denyDim: "rgba(239,68,68,0.12)",
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/**
 * Square, everywhere.
 *
 * The site's public surfaces are `rounded-none` with a hard 2px border, and
 * the app should read as the same object. The scale is kept rather than
 * deleted so the call sites still say which edge they meant — if a rounded
 * variant is ever wanted back, it changes here and nowhere else.
 */
export const radius = {
  sm: 0,
  md: 0,
  lg: 0,
  pill: 0,
} as const;

/** Border weights. `hard` is the site's `border-2` on buttons and cards. */
export const stroke = {
  hair: 1,
  hard: 2,
} as const;

export const type = {
  // Headings on the site are `font-black tracking-tight uppercase`, so the
  // weights here go to 900 and the components uppercase their text.
  display: { fontSize: 30, fontWeight: "900", letterSpacing: -0.8 },
  title: { fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  heading: { fontSize: 17, fontWeight: "900", letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: "400" },
  /** Button text — the site's `font-black tracking-wider uppercase`. */
  label: { fontSize: 13, fontWeight: "900", letterSpacing: 1.2 },
  caption: { fontSize: 12, fontWeight: "400" },
  /** Uppercase section markers, as on the site. */
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  mono: {
    fontSize: 13,
    fontFamily: "Menlo",
  },
} as const;
