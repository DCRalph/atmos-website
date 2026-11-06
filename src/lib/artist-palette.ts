import { contrast } from "./artist-theme";

/** Colours for a theme, picked from one image. */
export type Palette = { ground: string; groundTop: string; accent: string };

/** A grey image gives a grey page with a white accent. */
const GREY: Palette = {
  ground: "#0a0a0a",
  groundTop: "#1f1f1f",
  accent: "#ffffff",
};

/**
 * A palette from an image's pixels (RGBA, as a canvas gives them; a small
 * copy is plenty). The accent is the image's most vivid colour that it has
 * plenty of, pushed bright enough to read on the ground; the ground is a near
 * black of the same hue, and the gradient's top a step lighter.
 */
export function paletteFrom(pixels: ArrayLike<number>): Palette {
  // Twelve hue bins, weighted by how vivid each pixel is.
  const bins = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  let seen = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3]! < 128) continue;
    seen += 1;
    const [r, g, b] = [pixels[i]!, pixels[i + 1]!, pixels[i + 2]!];
    const { h, s, l } = toHsl(r, g, b);
    if (s < 0.25 || l < 0.12 || l > 0.9) continue;
    const w = s * (1 - Math.abs(l - 0.5));
    const bin = bins[Math.floor(h / 30) % 12]!;
    bin.w += w;
    bin.r += r * w;
    bin.g += g * w;
    bin.b += b * w;
  }
  const best = bins.reduce((a, b) => (b.w > a.w ? b : a));
  // Colour has to be more than a few stray pixels to count.
  if (!seen || best.w < seen * 0.02) return GREY;

  const { h, s } = toHsl(best.r / best.w, best.g / best.w, best.b / best.w);
  const ground = fromHsl(h, Math.min(s, 0.5), 0.05);
  let l = 0.55;
  let accent = fromHsl(h, Math.max(s, 0.65), l);
  while (contrast(accent, ground) < 4 && l < 0.85) {
    l += 0.05;
    accent = fromHsl(h, Math.max(s, 0.65), l);
  }
  return { ground, groundTop: fromHsl(h, Math.min(s, 0.6), 0.14), accent };
}

/** Whether two palettes would look the same on a page. */
export function samePalette(a: Palette, b: Palette) {
  const hue = (hex: string) => {
    const [r, g, b] = rgb(hex);
    return toHsl(r, g, b).h;
  };
  const d = Math.abs(hue(a.accent) - hue(b.accent));
  return Math.min(d, 360 - d) < 20;
}

const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];

function toHsl(r: number, g: number, b: number) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h =
    max === R
      ? ((G - B) / d + 6) % 6
      : max === G
        ? (B - R) / d + 2
        : (R - G) / d + 4;
  return { h: h * 60, s, l };
}

function fromHsl(h: number, s: number, l: number) {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return `#${[f(0), f(8), f(4)]
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
