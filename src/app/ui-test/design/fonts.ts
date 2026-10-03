import {
  Anybody,
  Archivo,
  Orbitron,
  Oxanium,
  Russo_One,
  Tomorrow,
  Unbounded,
} from "next/font/google";

// Candidate display faces for the stretched type system. Archivo and Anybody
// are variable on the width axis, so the "stretch" is real letterform width
// (font-stretch), not a CSS transform. Unbounded is wide by design.
export const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-mx-archivo",
});

export const anybody = Anybody({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-mx-anybody",
});

export const unbounded = Unbounded({
  subsets: ["latin"],
  variable: "--font-mx-unbounded",
});

// Heading candidates picked to echo the ATMOS logo, which is custom lettering
// (flat-topped A, rectangular O, square M, heavy, arched). None is the logo's
// font; each shares some of its shapes.
export const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-mx-orbitron",
});

export const russoOne = Russo_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-mx-russo",
});

export const oxanium = Oxanium({
  subsets: ["latin"],
  variable: "--font-mx-oxanium",
});

export const tomorrow = Tomorrow({
  subsets: ["latin"],
  weight: ["800", "900"],
  variable: "--font-mx-tomorrow",
});

export const fontVariables = [
  archivo.variable,
  anybody.variable,
  unbounded.variable,
  orbitron.variable,
  russoOne.variable,
  oxanium.variable,
  tomorrow.variable,
].join(" ");
