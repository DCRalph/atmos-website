import "server-only";

import sharp from "sharp";

/**
 * Pass artwork.
 *
 * Rasterised from inline SVG rather than read off disk. Files under `public/`
 * are served from the CDN and are not reliably present in a serverless
 * function's filesystem, and a pass that fails to build because an icon went
 * missing in production is a bad way to find that out. Sharp is already a
 * dependency for image uploads, so this costs nothing extra.
 *
 * Apple rejects a pass without `icon.png`. The logo is optional but it is what
 * appears at the top of the ticket, so it is worth having.
 */

const ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" fill="#0b0b0c"/>
  <text x="128" y="128" font-family="Helvetica,Arial,sans-serif" font-size="150"
        font-weight="700" fill="#ffffff" text-anchor="middle"
        dominant-baseline="central">A</text>
</svg>`;

const LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="150" viewBox="0 0 480 150">
  <rect width="480" height="150" fill="none"/>
  <text x="0" y="75" font-family="Helvetica,Arial,sans-serif" font-size="64"
        font-weight="700" letter-spacing="14" fill="#ffffff"
        dominant-baseline="central">ATMOS</text>
</svg>`;

type ImageSet = Record<string, Buffer>;

let cached: ImageSet | null = null;

async function render(
  svg: string,
  width: number,
  height: number,
): Promise<Buffer> {
  return sharp(Buffer.from(svg))
    .resize(width, height, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

/** The image files every Atmos pass ships with, built once per process. */
export async function getPassImages(): Promise<ImageSet> {
  if (cached) return cached;

  const [icon, icon2x, icon3x, logo, logo2x] = await Promise.all([
    render(ICON_SVG, 29, 29),
    render(ICON_SVG, 58, 58),
    render(ICON_SVG, 87, 87),
    render(LOGO_SVG, 160, 50),
    render(LOGO_SVG, 320, 100),
  ]);

  cached = {
    "icon.png": icon,
    "icon@2x.png": icon2x,
    "icon@3x.png": icon3x,
    "logo.png": logo,
    "logo@2x.png": logo2x,
  };

  return cached;
}
