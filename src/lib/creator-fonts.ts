import { Big_Shoulders, Bodoni_Moda, Unbounded } from "next/font/google";
import { siteFontVariables } from "~/lib/site-fonts";

// Creator theme display faces beyond the site's own (Orbitron, Anybody); see
// `FACES` in `~/lib/creator-theme`. Kept out of `fonts.ts` so the admin never
// loads them.
const unbounded = Unbounded({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--font-creator-unbounded",
});

// next/font has no fallback metrics for Big Shoulders and warns on every
// start without this.
const shoulders = Big_Shoulders({
  subsets: ["latin"],
  weight: ["900"],
  adjustFontFallback: false,
  variable: "--font-creator-shoulders",
});

const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--font-creator-bodoni",
});

/** Site faces plus every creator display face, for a profile's root. */
export const creatorFontVariables = [
  siteFontVariables,
  unbounded.variable,
  shoulders.variable,
  bodoni.variable,
].join(" ");
