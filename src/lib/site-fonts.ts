import { Anybody, Archivo } from "next/font/google";

// Public-site type. Anybody carries the stretched display voice through its
// width axis (font-stretch), Archivo sets body copy at normal width. Kept out
// of `fonts.ts` so the admin never loads them.
export const siteDisplay = Anybody({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-site-display",
});

// Anybody draws macrons beside the letter instead of above it, which breaks
// te reo (Pōneke, Ōtautahi). This face only carries the latin-ext range, so
// sitting first in the display stack it draws just those characters, at
// Archivo's widest, and Anybody draws everything else.
export const siteDisplayExtended = Archivo({
  subsets: ["latin-ext"],
  axes: ["wdth"],
  preload: false,
  variable: "--font-site-display-ext",
});

export const siteBody = Archivo({
  subsets: ["latin", "latin-ext"],
  variable: "--font-site-body",
});

export const siteFontVariables = `${siteDisplay.variable} ${siteDisplayExtended.variable} ${siteBody.variable}`;
