import { Big_Shoulders, Bodoni_Moda, Unbounded } from "next/font/google";
import { siteFontVariables } from "~/lib/site-fonts";

// Theme display faces beyond the site's own (Orbitron, Anybody). Each one is
// a different voice a creator can pick for their name and headings.
const unbounded = Unbounded({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--font-cp-unbounded",
});

// next/font has no fallback metrics for Big Shoulders and warns on every
// start without this.
const shoulders = Big_Shoulders({
  subsets: ["latin"],
  weight: ["900"],
  adjustFontFallback: false,
  variable: "--font-cp-shoulders",
});

const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["800"],
  style: ["normal", "italic"],
  variable: "--font-cp-bodoni",
});

export const profileFontVariables = [
  siteFontVariables,
  unbounded.variable,
  shoulders.variable,
  bodoni.variable,
].join(" ");
