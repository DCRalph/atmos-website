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

  text: "#FFFFFF",
  textSoft: "rgba(255,255,255,0.62)",
  textFaint: "rgba(255,255,255,0.38)",

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

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

export const type = {
  display: { fontSize: 30, fontWeight: "800", letterSpacing: -0.6 },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: "700" },
  body: { fontSize: 15, fontWeight: "400" },
  label: { fontSize: 13, fontWeight: "600" },
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
