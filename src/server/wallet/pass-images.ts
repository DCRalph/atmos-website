import "server-only";

import sharp from "sharp";

import { ATMOS_ICON_PNG, ATMOS_WORDMARK_PNG } from "./pass-logo";

/**
 * Pass artwork.
 *
 * Rasterised from inline SVG and an embedded PNG rather than read off disk.
 * Files under `public/` are served from the CDN and are not reliably present in
 * a serverless function's filesystem, and a pass that fails to build because an
 * icon went missing in production is a bad way to find that out. Sharp is
 * already a dependency for image uploads, so this costs nothing extra.
 *
 * Apple rejects a pass without `icon.png`. `logo.png` is what sits in the pass
 * header, and `strip.png` is the band the primary field is drawn over on an
 * event ticket — together they are the whole look of the thing.
 */

/** Ink and ground, matching the site's brutalist black. */
const INK = "#FFFFFF";
const GROUND = "#0B0B0C";
/** `--accent-strong` from the site's globals.css. */
const ACCENT = "#470082";

/**
 * The strip sits behind the event name. Kept near-black so white type stays
 * legible on it, with the accent bleeding in from the right and the same
 * diagonal hatch as the icon so the pass reads as one family.
 */
const STRIP_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="1125" height="294" viewBox="0 0 1125 294">
  <defs>
    <linearGradient id="wash" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${GROUND}"/>
      <stop offset="55%" stop-color="${GROUND}"/>
      <stop offset="100%" stop-color="${ACCENT}"/>
    </linearGradient>
    <pattern id="stripHatch" width="28" height="28" patternUnits="userSpaceOnUse"
             patternTransform="rotate(135)">
      <rect width="28" height="28" fill="none"/>
      <line x1="0" y1="0" x2="0" y2="28" stroke="${INK}" stroke-opacity="0.07"
            stroke-width="10"/>
    </pattern>
  </defs>
  <rect width="1125" height="294" fill="url(#wash)"/>
  <rect width="1125" height="294" fill="url(#stripHatch)"/>
  <!-- A hard rule top and bottom: the site's 2px borders, at pass scale. -->
  <rect x="0" y="0" width="1125" height="6" fill="${INK}" fill-opacity="0.22"/>
  <rect x="0" y="288" width="1125" height="6" fill="${INK}" fill-opacity="0.22"/>
</svg>`;

type ImageSet = Record<string, Buffer>;

let cached: ImageSet | null = null;

async function renderSvg(
  svg: string,
  width: number,
  height: number,
): Promise<Buffer> {
  return sharp(Buffer.from(svg))
    .resize(width, height, {
      fit: "cover",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

/** The wordmark, scaled to one of Apple's logo slots, transparent behind. */
async function renderLogo(width: number, height: number): Promise<Buffer> {
  return sharp(ATMOS_WORDMARK_PNG)
    .resize(width, height, {
      fit: "contain",
      position: "left",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

/** The square mark, for the icon slot Apple shows in notifications. */
async function renderIcon(size: number): Promise<Buffer> {
  return sharp(ATMOS_ICON_PNG).resize(size, size).png().toBuffer();
}

/** The image files every Atmos pass ships with, built once per process. */
export async function getPassImages(): Promise<ImageSet> {
  if (cached) return cached;

  const [icon, icon2x, icon3x, logo, logo2x, logo3x, strip, strip2x, strip3x] =
    await Promise.all([
      renderIcon(29),
      renderIcon(58),
      renderIcon(87),
      // Apple's logo slot is 160x50pt. The wordmark is ~4.4:1, so it lands
      // comfortably inside that without being scaled to nothing.
      renderLogo(160, 50),
      renderLogo(320, 100),
      renderLogo(480, 150),
      // Strip on an event ticket is 375x98pt.
      renderSvg(STRIP_SVG, 375, 98),
      renderSvg(STRIP_SVG, 750, 196),
      renderSvg(STRIP_SVG, 1125, 294),
    ]);

  cached = {
    "icon.png": icon,
    "icon@2x.png": icon2x,
    "icon@3x.png": icon3x,
    "logo.png": logo,
    "logo@2x.png": logo2x,
    "logo@3x.png": logo3x,
    "strip.png": strip,
    "strip@2x.png": strip2x,
    "strip@3x.png": strip3x,
  };

  return cached;
}
