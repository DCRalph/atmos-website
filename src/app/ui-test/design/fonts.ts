import { Anybody, Archivo, Unbounded } from "next/font/google";

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

export const fontVariables = [
  archivo.variable,
  anybody.variable,
  unbounded.variable,
].join(" ");
