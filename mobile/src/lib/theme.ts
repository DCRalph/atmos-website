/**
 * Atmos, natively: the public site's design system (`src/styles/site.css`).
 *
 * True black ground, white type, one acid accent. Three faces: Orbitron for
 * big headings, stretched Anybody for display text and labels, Archivo for
 * body copy. Shape follows the site's "hard + round" rule: imagery is
 * square-edged, anything pressable is a pill, floating panels are rounded.
 *
 * The door palette is kept separate and deliberately loud: those colours are
 * read at arm's length in a dark room by somebody deciding whether to let a
 * stranger in, so they are the same signal colours the web scanner already
 * uses rather than a softer set.
 */

export const colors = {
  bg: "#000000",
  /** The site's `--site-raised`, for panels on black. */
  surface: "#0B0B0B",
  surfaceRaised: "#161616",
  /** Hairline between rows, the site's `border-white/10`. */
  border: "rgba(255,255,255,0.10)",
  borderStrong: "rgba(255,255,255,0.20)",
  /** Outline pills, the site's `border-white/40`. */
  borderHard: "rgba(255,255,255,0.40)",

  text: "#FFFFFF",
  textSoft: "rgba(255,255,255,0.65)",
  textFaint: "rgba(255,255,255,0.45)",

  /** `--site-accent`: fills. Text on it is `accentInk`. */
  accent: "#C6FF33",
  accentInk: "#000000",
  danger: "#FF8A8A",

  /** Door signal colours — admitted / exception / refused. */
  in: "#34D399",
  inDim: "rgba(52,211,153,0.12)",
  warn: "#F5A524",
  warnDim: "rgba(245,165,36,0.12)",
  deny: "#EF4444",
  denyDim: "rgba(239,68,68,0.12)",

  /**
   * Somebody who was in and has gone.
   *
   * Its own colour rather than a reuse of `warn`, because "left" is not an
   * exception — it is the ordinary end of a normal night. It has to be
   * distinguishable at arm's length from both the green of an admission and
   * the amber of an override, which is what the web's sky-500 does.
   */
  left: "#38BDF8",
  leftDim: "rgba(56,189,248,0.12)",
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
 * `sm` is the site's chip radius, `lg` its floating-panel radius, `pill` is
 * anything you press. Imagery stays square: posters never take a radius.
 */
export const radius = {
  sm: 6,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/**
 * The display's own corner radius, near enough for every current iPhone.
 *
 * Apple's rule for anything floating near the screen edge is concentric
 * corners: its radius is the display's minus the gap between them, so the
 * two curves run parallel. `concentric(12)` is the radius for a panel 12pt in.
 */
export const DISPLAY_RADIUS = 55;
export const concentric = (inset: number) =>
  Math.max(radius.lg, DISPLAY_RADIUS - inset);

export const stroke = {
  hair: 1,
  hard: 2,
} as const;

/**
 * Font files, embedded by the expo-font plugin (see `app.config.ts`). Each
 * file is its own family, so these never take a `fontWeight`.
 */
export const fonts = {
  /** Orbitron 900: large headings only, the site's `t-heading`. */
  heading: "AtmosHeading-Black",
  /** Anybody, stretched, 800: names and numbers, the site's `t-display`. */
  display: "AtmosDisplay-Heavy",
  /** Anybody, stretched, 700: small caps for labels and buttons, `t-label`. */
  label: "AtmosDisplay-Bold",
  body: "AtmosBody-Regular",
  bodyStrong: "AtmosBody-SemiBold",
} as const;

export const type = {
  /** Page and section headings. Uppercase, tight. */
  heading: {
    fontFamily: fonts.heading,
    fontSize: 30,
    lineHeight: 30,
    textTransform: "uppercase",
  },
  /** Gig names, prices, counts. */
  display: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 21,
    letterSpacing: -0.2,
    textTransform: "uppercase",
  },
  /** Buttons, tabs, meta: wide caps tracked out. */
  label: {
    fontFamily: fonts.label,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  mono: { fontFamily: "Menlo", fontSize: 13 },
} as const;
