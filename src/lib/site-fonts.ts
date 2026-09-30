import { Anybody, Archivo, Orbitron } from "next/font/google";
import localFont from "next/font/local";

// Public-site type. Orbitron sets headings: the closest free match to the
// logo's lettering (flat-topped A, square M and O). Anybody carries labels,
// nav and buttons through its width axis (font-stretch), Archivo sets body
// copy at normal width. Kept out of `fonts.ts` so the admin never loads them.
export const siteHeading = Orbitron({
  subsets: ["latin"],
  weight: ["800", "900"],
  variable: "--font-site-heading",
});

export const siteDisplay = Anybody({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-site-display",
});

// Neither Orbitron nor Anybody draws te reo macrons properly (Pōneke,
// Ōtautahi). This is Archivo's latin-ext file only (wide, 700 to 900), under
// its own family name and an explicit unicode-range, sitting first in both
// display stacks so it draws just those characters. next/font/google can't do
// this: it declares every subset, and a shared family name (it was Archivo,
// same as the body) merges the ranges and takes over every heading.
export const siteDisplayExtended = localFont({
  src: "../fonts/archivo-latin-ext.woff2",
  weight: "700 900",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1E00-1E9F, U+1EF2-1EFF",
    },
    { prop: "font-stretch", value: "125%" },
  ],
  variable: "--font-site-display-ext",
});

export const siteBody = Archivo({
  subsets: ["latin", "latin-ext"],
  variable: "--font-site-body",
});

export const siteFontVariables = `${siteHeading.variable} ${siteDisplay.variable} ${siteDisplayExtended.variable} ${siteBody.variable}`;
