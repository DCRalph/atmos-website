import "server-only";

import sharp from "sharp";

import { stripSvg, type PassTheme } from "~/lib/ticketing/pass-theme";
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



type ImageSet = Record<string, Buffer>;

/**
 * Themed artwork is cached per theme, not globally.
 *
 * Most events run house style, so in practice this is one entry doing the work
 * the old single cache did. It is bounded by the number of distinct themes in
 * use rather than by ticket volume, so it cannot grow with traffic.
 */
const themedCache = new Map<string, ImageSet>();

function themeKey(theme: PassTheme): string {
  return [
    theme.stripStyle,
    theme.accentHex,
    theme.backgroundHex,
    theme.foregroundHex,
    theme.labelHex,
  ].join("|");
}

/** The brand artwork, which no event theme changes. Built once per process. */
let brandCache: ImageSet | null = null;

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

/**
 * Optical centring for the wordmark.
 *
 * The mark is top-heavy: the letters carry the weight and the swoosh trails
 * below them, so the ink's centre of mass sits at 43.6% of the trimmed height
 * rather than 50%. Centred on its bounding box it reads as sitting too high.
 *
 * Padding the top by `T` moves the centroid to the middle of the canvas when
 * `centroid + T = (height + T) / 2` — for the trimmed 480x108 mark that is
 * ~14px, or about 13% of its height. Expressed as a ratio so it survives the
 * source artwork being re-exported at another size.
 */
const WORDMARK_TOP_PAD_RATIO = 14 / 108;

/**
 * The wordmark with its optical padding, built once.
 *
 * Two passes on purpose: sharp applies `extend` after `resize` within a single
 * pipeline whatever order they are called in, which would pad the outside of
 * the finished slot and leave the logo undersized in it. Padding first, then
 * fitting the padded artwork, keeps the output exactly the slot size.
 */
let paddedWordmark: Promise<Buffer> | null = null;

function getPaddedWordmark(): Promise<Buffer> {
  paddedWordmark ??= (async () => {
    const { height = 0 } = await sharp(ATMOS_WORDMARK_PNG).metadata();
    return sharp(ATMOS_WORDMARK_PNG)
      .extend({
        top: Math.round(height * WORDMARK_TOP_PAD_RATIO),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
  })();
  return paddedWordmark;
}

/** The wordmark, scaled to one of Apple's logo slots, transparent behind. */
async function renderLogo(width: number, height: number): Promise<Buffer> {
  return sharp(await getPaddedWordmark())
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

/**
 * Icon and wordmark — the same on every pass.
 *
 * The logo slot Apple allows is 160x50pt, but the wordmark filling it dwarfs
 * the header field beside it. Half that reads as a mark rather than a banner
 * and sits at about the weight of the "DOORS" text it shares the row with.
 */
const LOGO_SLOT = { width: 80, height: 25 } as const;

async function getBrandImages(): Promise<ImageSet> {
  if (brandCache) return brandCache;

  const [icon, icon2x, icon3x, logo, logo2x, logo3x] = await Promise.all([
    renderIcon(29),
    renderIcon(58),
    renderIcon(87),
    renderLogo(LOGO_SLOT.width, LOGO_SLOT.height),
    renderLogo(LOGO_SLOT.width * 2, LOGO_SLOT.height * 2),
    renderLogo(LOGO_SLOT.width * 3, LOGO_SLOT.height * 3),
  ]);

  brandCache = {
    "icon.png": icon,
    "icon@2x.png": icon2x,
    "icon@3x.png": icon3x,
    "logo.png": logo,
    "logo@2x.png": logo2x,
    "logo@3x.png": logo3x,
  };

  return brandCache;
}

/** The image files a pass ships with, for one event's theme. */
export async function getPassImages(theme: PassTheme): Promise<ImageSet> {
  const key = themeKey(theme);
  const hit = themedCache.get(key);
  if (hit) return hit;

  const brand = await getBrandImages();

  // Strip on an event ticket is 375x98pt. Rendered at each scale rather than
  // upscaled, so the hatch and bar edges stay hard on a 3x screen.
  const [strip, strip2x, strip3x] = await Promise.all([
    renderSvg(stripSvg(theme, 375, 98), 375, 98),
    renderSvg(stripSvg(theme, 750, 196), 750, 196),
    renderSvg(stripSvg(theme, 1125, 294), 1125, 294),
  ]);

  const images: ImageSet = {
    ...brand,
    // A themeless band would be a black bar over the title rather than no band
    // at all, so `NONE` omits the file entirely and lets the pass fall back to
    // its plain layout.
    ...(theme.stripStyle === "NONE"
      ? {}
      : {
          "strip.png": strip,
          "strip@2x.png": strip2x,
          "strip@3x.png": strip3x,
        }),
  };

  themedCache.set(key, images);
  return images;
}
