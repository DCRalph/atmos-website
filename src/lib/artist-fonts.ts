import { Big_Shoulders, Bodoni_Moda, Unbounded } from "next/font/google";
import { siteFontVariables } from "~/lib/site-fonts";

// Artist theme display faces beyond the site's own (Orbitron, Anybody); see
// `FACES` in `~/lib/artist-theme`. Kept out of `fonts.ts` so the admin never
// loads them.
const unbounded = Unbounded({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--font-artist-unbounded",
});

// next/font has no fallback metrics for Big Shoulders and warns on every
// start without this.
const shoulders = Big_Shoulders({
  subsets: ["latin"],
  weight: ["900"],
  adjustFontFallback: false,
  variable: "--font-artist-shoulders",
});

const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--font-artist-bodoni",
});

/** Site faces plus every artist display face, for a profile's root. */
export const artistFontVariables = [
  siteFontVariables,
  unbounded.variable,
  shoulders.variable,
  bodoni.variable,
].join(" ");
