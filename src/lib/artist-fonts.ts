import {
  Anton,
  Archivo_Black,
  Bebas_Neue,
  Big_Shoulders,
  Bodoni_Moda,
  Bricolage_Grotesque,
  DM_Serif_Display,
  IBM_Plex_Mono,
  Inter_Tight,
  JetBrains_Mono,
  Newsreader,
  Playfair_Display,
  Rubik_Mono_One,
  Shrikhand,
  Space_Grotesk,
  Space_Mono,
  Syne,
  Unbounded,
} from "next/font/google";
import { siteFontVariables } from "~/lib/site-fonts";

// Artist theme faces beyond the site's own (Orbitron, Anybody, Archivo); see
// `FACES` and `BODIES` in `~/lib/artist-theme`. Kept out of `fonts.ts` so the
// admin never loads them. Declaring a face costs nothing until a page uses
// it: the browser only downloads the files its text is set in. The faces added
// with the theme editor's Type tab aren't preloaded for that reason.
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

const syne = Syne({
  subsets: ["latin"],
  preload: false,
  weight: ["800"],
  variable: "--font-artist-syne",
});
const anton = Anton({
  subsets: ["latin"],
  preload: false,
  weight: ["400"],
  variable: "--font-artist-anton",
});
const bebas = Bebas_Neue({
  subsets: ["latin"],
  preload: false,
  weight: ["400"],
  variable: "--font-artist-bebas",
});
const playfair = Playfair_Display({
  subsets: ["latin"],
  preload: false,
  weight: ["900"],
  variable: "--font-artist-playfair",
});
const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  preload: false,
  weight: ["400"],
  variable: "--font-artist-dmserif",
});
const spaceMono = Space_Mono({
  subsets: ["latin"],
  preload: false,
  weight: ["700"],
  variable: "--font-artist-spacemono",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  preload: false,
  weight: ["800"],
  variable: "--font-artist-jetbrains",
});
const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  preload: false,
  weight: ["400"],
  variable: "--font-artist-archivoblack",
});
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  preload: false,
  weight: ["800"],
  variable: "--font-artist-bricolage",
});
const rubikMono = Rubik_Mono_One({
  subsets: ["latin"],
  preload: false,
  weight: ["400"],
  variable: "--font-artist-rubikmono",
});
const shrikhand = Shrikhand({
  subsets: ["latin"],
  preload: false,
  weight: ["400"],
  variable: "--font-artist-shrikhand",
});

// Body faces: every weight the page sets text in.
const grotesk = Space_Grotesk({
  subsets: ["latin"],
  preload: false,
  variable: "--font-artist-grotesk",
});
const inter = Inter_Tight({
  subsets: ["latin"],
  preload: false,
  variable: "--font-artist-inter",
});
const plex = IBM_Plex_Mono({
  subsets: ["latin"],
  preload: false,
  weight: ["400", "500", "600"],
  variable: "--font-artist-plex",
});
const newsreader = Newsreader({
  subsets: ["latin"],
  preload: false,
  variable: "--font-artist-newsreader",
});

/** Site faces plus every artist face, for a profile's root and the theme pickers. */
export const artistFontVariables = [
  siteFontVariables,
  unbounded,
  shoulders,
  bodoni,
  syne,
  anton,
  bebas,
  playfair,
  dmSerif,
  spaceMono,
  jetbrains,
  archivoBlack,
  bricolage,
  rubikMono,
  shrikhand,
  grotesk,
  inter,
  plex,
  newsreader,
]
  .map((f) => (typeof f === "string" ? f : f.variable))
  .join(" ");
