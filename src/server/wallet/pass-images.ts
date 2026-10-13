import "server-only";

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import sharp, { type OverlayOptions } from "sharp";

import { FileUploadStatus } from "~Prisma/client";
import { db } from "~/server/db";
import { getObjectBuffer } from "~/server/uploads/r2";

import {
  DEFAULT_PASS_THEME,
  PASS_LAYOUT_INFO,
  badgeBox,
  stripSvg,
  stripTitleBox,
  type PassLayout,
  type PassTheme,
  type StripBadge,
} from "~/lib/ticketing/pass-theme";
import { PASS_FONT_TTF } from "./pass-font";
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
 *
 * A design can swap two of them for uploads: a photo for the band and a logo
 * for the wordmark. Those come out of R2, and a missing one degrades to the
 * house artwork rather than failing the pass.
 *
 * Two more layouts are built from a portrait poster: `BLUR` lays it behind the
 * whole pass as `background.png` with a `thumbnail.png` beside the title, and
 * `POSTER` ships it as the iOS 18 poster artwork while keeping the band for
 * phones that cannot draw a poster.
 */

type ImageSet = Record<string, Buffer>;

/** What one call to {@link getPassImages} produced. */
type PassArtwork = {
  files: ImageSet;
  /**
   * Whether the band carries the event name. When it does the pass leaves its
   * primary field empty, because that field is what would be drawn over it.
   */
  titleDrawn: boolean;
  /**
   * Whether the poster made it into the bundle. False means the layout fell
   * back to the band, and the pass must not claim a poster it does not carry.
   */
  posterDrawn: boolean;
};

/**
 * Themed artwork is cached per theme, not globally.
 *
 * Most events run house style, so in practice this is a handful of entries
 * doing the work the old single cache did. It is bounded by the number of
 * distinct themes, levels and event names in use rather than by ticket volume,
 * so it cannot grow with traffic — and the lid below keeps a long-running
 * process from accumulating every event of the season.
 */
const themedCache = new Map<string, PassArtwork>();
const MAX_CACHED_THEMES = 32;

function remember(key: string, artwork: PassArtwork): PassArtwork {
  if (themedCache.size >= MAX_CACHED_THEMES) {
    // Insertion order: the oldest theme is the least likely to be asked for
    // again, and re-rendering one is a few hundred milliseconds, not an error.
    const oldest = themedCache.keys().next().value;
    if (oldest !== undefined) themedCache.delete(oldest);
  }
  themedCache.set(key, artwork);
  return artwork;
}

function themeKey({
  theme,
  intensity = 0,
  badge = null,
  title = null,
  titleLabel = "EVENT",
  stripImageId = null,
  logoImageId = null,
  layout = "BAND",
  posterImageId = null,
}: PassImageOptions): string {
  return [
    layout,
    posterImageId ?? "-",
    theme.stripStyle,
    theme.accentHex,
    theme.backgroundHex,
    theme.foregroundHex,
    theme.labelHex,
    (theme.stripDim ?? 0).toFixed(2),
    intensity.toFixed(2),
    badge ? `${badge.text}:${badge.background}:${badge.foreground}` : "-",
    title ?? "-",
    titleLabel,
    stripImageId ?? "-",
    logoImageId ?? "-",
  ].join("|");
}

/**
 * Uploaded artwork, by `file_upload.id`.
 *
 * Uploads are immutable under their id, so a hit never goes stale. Only
 * successes are kept: a file that failed to load is asked for again next time
 * rather than remembered as missing.
 */
const uploadCache = new Map<string, Buffer>();
const MAX_CACHED_UPLOADS = 16;

async function loadUpload(id: string): Promise<Buffer | null> {
  const hit = uploadCache.get(id);
  if (hit) return hit;
  try {
    const file = await db.file_upload.findFirst({
      where: { id, status: FileUploadStatus.OK },
      select: { key: true },
    });
    if (!file) return null;
    const buffer = await getObjectBuffer(file.key);
    if (uploadCache.size >= MAX_CACHED_UPLOADS) {
      const oldest = uploadCache.keys().next().value;
      if (oldest !== undefined) uploadCache.delete(oldest);
    }
    uploadCache.set(id, buffer);
    return buffer;
  } catch (cause) {
    console.error("[wallet] could not load pass artwork", { id }, cause);
    return null;
  }
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

/**
 * The bundled font, materialised where sharp can reach it.
 *
 * `fontfile` takes a path, not a buffer, so the embedded bytes are written to
 * the process's temp directory the first time a badge is drawn and reused
 * after. `/tmp` is writable on every serverless runtime this ships to.
 */
let fontPath: string | null = null;

function getFontPath(): string {
  if (fontPath) return fontPath;
  const dir = mkdtempSync(join(tmpdir(), "atmos-pass-"));
  const file = join(dir, "pass-font.ttf");
  writeFileSync(file, PASS_FONT_TTF);
  fontPath = file;
  return file;
}

/** Pango markup is XML, so a venue called "Smith & Sons" needs escaping. */
function escapeMarkup(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

type Raster = { buffer: Buffer; width: number; height: number };

/**
 * A run of text, rasterised rather than left to the SVG.
 *
 * `<text>` in the strip SVG renders through librsvg, which resolves fonts via
 * fontconfig — and a serverless image has none, so it came out as tofu boxes in
 * production while looking correct on macOS via CoreText. Drawing it here with
 * our own font file takes the environment out of it.
 *
 * Sizing goes through `dpi` rather than a font description: pango is asked for
 * 12pt and the dots-per-inch are set so that 12pt lands on the pixel size we
 * actually want, which keeps one number in play instead of two.
 */
async function renderText({
  text,
  colour,
  sizePx,
  /** Wrap width. Text longer than this breaks at a word rather than running on. */
  maxWidthPx,
  /**
   * Fit to this height instead of using `sizePx`. Sharp then picks the size
   * itself, which is the only way to be sure of something that has to fit —
   * a single word longer than the lane cannot be wrapped out of trouble.
   */
  maxHeightPx,
  /** Pango units — 1024ths of a point, so a constant here is constant tracking. */
  letterSpacing,
}: {
  text: string;
  colour: string;
  sizePx: number;
  maxWidthPx?: number;
  maxHeightPx?: number;
  letterSpacing?: number;
}): Promise<Raster | null> {
  try {
    const spacing =
      letterSpacing === undefined ? "" : ` letter_spacing="${letterSpacing}"`;
    const buffer = await sharp({
      text: {
        text: `<span foreground="${colour}"${spacing}>${escapeMarkup(text)}</span>`,
        font: "sans",
        fontfile: getFontPath(),
        rgba: true,
        ...(maxWidthPx ? { width: Math.round(maxWidthPx) } : {}),
        ...(maxHeightPx
          ? { height: Math.round(maxHeightPx) }
          : { dpi: Math.round(72 * (sizePx / 12)) }),
      },
    })
      .png()
      .toBuffer();

    const meta = await sharp(buffer).metadata();
    return { buffer, width: meta.width ?? 0, height: meta.height ?? 0 };
  } catch {
    // Better than failing the whole pass because a font could not be written
    // or parsed: the caller falls back to artwork without this text in it.
    return null;
  }
}

/** The chip's letters, centred in the chip the band SVG drew. */
async function renderBadgeText(
  badge: StripBadge,
  width: number,
  height: number,
): Promise<OverlayOptions | null> {
  const box = badgeBox(badge.text, width, height);
  const text = await renderText({
    text: badge.text,
    colour: badge.foreground,
    sizePx: box.fontSize,
    letterSpacing: Math.round(box.fontSize * 140),
  });
  if (!text) return null;

  return {
    input: text.buffer,
    left: Math.round(box.x + (box.width - text.width) / 2),
    top: Math.round(box.y + (box.height - text.height) / 2),
  };
}

/**
 * The event name on the band, in the lane the chip left it.
 *
 * Set as large as it will go. The size is searched for rather than chosen from
 * a list of sizes: whatever the name, it ends up at the largest type that fits
 * the lane, which is the whole point of drawing it ourselves instead of letting
 * Wallet shrink it to a caption. Long names wrap — two or three lines of
 * readable type beat one line of small type — and only a name that will not fit
 * even at the floor size is cut at a word, with the full one on the back.
 */
const LABEL_SIZE_RATIO = 0.095;
const LABEL_GAP_RATIO = 0.035;
/** Below this the name is not worth setting; cut it instead. */
const TITLE_MIN_RATIO = 0.12;
/** ~0.18em of tracking, matching the small caps Wallet sets labels in. */
const LABEL_TRACKING = 2200;

function ellipsise(text: string, maxChars: number): string {
  const clean = text.replace(/…$/, "").trimEnd();
  if (clean.length <= maxChars) return clean;
  const cut = clean.slice(0, Math.max(1, maxChars - 1));
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * The largest size this text fits the box at, or null if even the floor is too
 * big for it.
 *
 * Binary search rather than a ladder, because "as large as it will go" is a
 * number, not one of seven. Both dimensions of the rendered block grow with the
 * size — more lines are taller, not shorter — so the fit is monotonic and the
 * search is sound. Six or seven rasters, then cached with the artwork.
 */
async function fitTitle({
  text,
  colour,
  maxWidthPx,
  maxHeightPx,
  minSizePx,
}: {
  text: string;
  colour: string;
  maxWidthPx: number;
  maxHeightPx: number;
  minSizePx: number;
}): Promise<Raster | null> {
  let low = minSizePx;
  // A line is always taller than its type, so a size the height of the box
  // cannot fit in it — an upper bound that costs one iteration to rule out.
  let high = Math.max(minSizePx, Math.floor(maxHeightPx));
  let best: Raster | null = null;

  while (low <= high) {
    const size = Math.floor((low + high) / 2);
    const attempt = await renderText({
      text,
      colour,
      sizePx: size,
      maxWidthPx,
    });
    if (!attempt) return null;

    if (attempt.height <= maxHeightPx && attempt.width <= maxWidthPx) {
      best = attempt;
      low = size + 1;
    } else {
      high = size - 1;
    }
  }

  return best;
}

async function renderTitleBlock(
  theme: PassTheme,
  title: string,
  /** The small caps above the title — "EVENT" on a ticket. */
  titleLabel: string,
  box: { x: number; y: number; width: number; height: number },
  stripHeight: number,
): Promise<OverlayOptions[] | null> {
  const label = await renderText({
    text: titleLabel,
    colour: theme.labelHex,
    sizePx: Math.max(6, Math.round(stripHeight * LABEL_SIZE_RATIO)),
    letterSpacing: LABEL_TRACKING,
  });
  if (!label) return null;

  const gap = Math.round(stripHeight * LABEL_GAP_RATIO);
  const room = box.height - label.height - gap;
  const minSize = Math.max(7, Math.round(stripHeight * TITLE_MIN_RATIO));

  const fit = (text: string) =>
    fitTitle({
      text,
      colour: theme.foregroundHex,
      maxWidthPx: box.width,
      maxHeightPx: room,
      minSizePx: minSize,
    });

  // The whole name first. Only if it cannot be set at the floor size does any
  // of it get cut, and then by a little at a time rather than to an estimate.
  let text = title.trim();
  let chosen = await fit(text);
  for (let attempt = 0; !chosen && attempt < 4; attempt++) {
    text = ellipsise(text, Math.max(8, Math.floor(text.length * 0.6)));
    chosen = await fit(text);
  }

  // Still nothing: a single word longer than the lane can hold at any size we
  // are willing to set. Hand the box to sharp and let it scale to fit.
  chosen ??= await renderText({
    text,
    colour: theme.foregroundHex,
    maxWidthPx: box.width,
    maxHeightPx: room,
    sizePx: minSize,
  });
  if (!chosen) return null;

  const blockHeight = label.height + gap + chosen.height;
  // Last check before it becomes a composite: sharp refuses an overlay that
  // runs off its canvas, and a pass that fails to build is worse than a pass
  // that lets Wallet set the name.
  if (
    blockHeight > box.height ||
    Math.max(label.width, chosen.width) > box.width
  ) {
    return null;
  }

  const top = Math.round(box.y + (box.height - blockHeight) / 2);

  return [
    { input: label.buffer, left: box.x, top },
    { input: chosen.buffer, left: box.x, top: top + label.height + gap },
  ];
}

/**
 * An uploaded logo in the header slot, left-aligned, transparent behind.
 *
 * Given more room than the wordmark: someone uploading a logo has sized it to
 * be seen, and a square mark squeezed into 25pt of height reads as a speck.
 */
const CUSTOM_LOGO_SLOT = { width: 120, height: 40 } as const;

async function renderUploadedLogo(
  source: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  return sharp(source)
    .resize(width, height, {
      fit: "contain",
      position: "left",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function getUploadedLogoImages(source: Buffer): Promise<ImageSet> {
  const { width, height } = CUSTOM_LOGO_SLOT;
  const [logo, logo2x, logo3x] = await Promise.all([
    renderUploadedLogo(source, width, height),
    renderUploadedLogo(source, width * 2, height * 2),
    renderUploadedLogo(source, width * 3, height * 3),
  ]);
  return { "logo.png": logo, "logo@2x.png": logo2x, "logo@3x.png": logo3x };
}

/**
 * Poster artwork sizes, in points, from Apple's Wallet guidelines. Rendered at
 * 2x and 3x only: nothing that can open a pass today has a 1x screen, and a
 * photo-sized PNG is the heaviest thing in the bundle.
 *
 * Apple's guidelines name the poster artwork `artwork.png`; the pass library's
 * device-tested poster examples ship it as `background.png`. One constant, so
 * the day a device says otherwise it is one word to change.
 */
const POSTER_ARTWORK_FILE = "background";
const POSTER_ARTWORK = { width: 358, height: 448 } as const;
const BLUR_BACKGROUND = { width: 343, height: 503 } as const;
const THUMBNAIL = { width: 90, height: 90 } as const;

/**
 * A photo cropped to fill a slot. Palette PNG, which is a third of the bytes
 * of truecolour and indistinguishable on a phone, where every one of these
 * ends up.
 */
async function renderPhoto(
  source: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  return sharp(source)
    .resize(width, height, { fit: "cover" })
    .png({ palette: true, quality: 90, compressionLevel: 9 })
    .toBuffer();
}

async function renderPhotoSet(
  source: Buffer,
  name: string,
  slot: { width: number; height: number },
  scales: readonly number[],
): Promise<ImageSet> {
  const entries = await Promise.all(
    scales.map(
      async (scale) =>
        [
          `${name}${scale === 1 ? "" : `@${scale}x`}.png`,
          await renderPhoto(source, slot.width * scale, slot.height * scale),
        ] as const,
    ),
  );
  return Object.fromEntries(entries);
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

/**
 * One strip: the band, then the chip's letters and the title on top.
 *
 * A photo band is the photo cropped to fill, with the band SVG — which for a
 * photo is only the shade, the edge rules and the chip — laid over it.
 */
async function renderStrip(
  theme: PassTheme,
  intensity: number,
  badge: StripBadge | null,
  title: string | null,
  titleLabel: string,
  photo: Buffer | null,
  width: number,
  height: number,
): Promise<{ image: Buffer; titleDrawn: boolean }> {
  const svg = Buffer.from(
    stripSvg(theme, width, height, intensity, badge, false),
  );
  const band = sharp(photo ?? svg).resize(width, height, { fit: "cover" });

  const overlays: OverlayOptions[] = photo ? [{ input: svg }] : [];

  if (badge) {
    const text = await renderBadgeText(badge, width, height);
    // A chip without its letters is still a colour block, which is better than
    // no pass at all.
    if (text) overlays.push(text);
  }

  let titleDrawn = false;
  if (title) {
    const box = stripTitleBox(width, height, badge);
    // A chip wide enough to leave no lane worth setting type in: better to let
    // Wallet draw the name over the band than to squeeze it into nothing.
    const block =
      box.width >= width * 0.35
        ? await renderTitleBlock(theme, title, titleLabel, box, height)
        : null;
    if (block) {
      overlays.push(...block);
      titleDrawn = true;
    }
  }

  const image = await (overlays.length > 0 ? band.composite(overlays) : band)
    .png()
    .toBuffer();

  return { image, titleDrawn };
}

export type PassImageOptions = {
  theme: PassTheme;
  /** From the ticket's access level, so two tickets to one event can differ. */
  intensity?: number;
  badge?: StripBadge | null;
  /**
   * Set only when the band has to carry the title itself — see
   * {@link stripTitleBox} — and the caller is told whether it got there,
   * because a name drawn twice is exactly the problem being avoided.
   */
  title?: string | null;
  /**
   * What the band calls the title. "EVENT" for a ticket; a lifetime pass sets
   * the holder's name there instead, under a label that says what it is.
   */
  titleLabel?: string;
  /** The band photo, drawn when the theme's style is `PHOTO`. */
  stripImageId?: string | null;
  /** A logo to use in place of the Atmos wordmark. */
  logoImageId?: string | null;
  /** Which of the layouts to build. Defaults to the band. */
  layout?: PassLayout;
  /** The portrait artwork a `BLUR` or `POSTER` layout is built from. */
  posterImageId?: string | null;
};

/** The image files a pass ships with, for one design. */
export async function getPassImages(
  options: PassImageOptions,
): Promise<PassArtwork> {
  const key = themeKey(options);
  const hit = themedCache.get(key);
  if (hit) return hit;

  const {
    intensity = 0,
    badge = null,
    title = null,
    titleLabel = "EVENT",
    layout: wanted = "BAND",
  } = options;
  const needsPoster = PASS_LAYOUT_INFO[wanted].needsPoster;

  const [brand, photo, logo, poster] = await Promise.all([
    getBrandImages(),
    options.theme.stripStyle === "PHOTO" && options.stripImageId
      ? loadUpload(options.stripImageId)
      : null,
    options.logoImageId ? loadUpload(options.logoImageId) : null,
    needsPoster && options.posterImageId
      ? loadUpload(options.posterImageId)
      : null,
  ]);

  // A poster that would not load means the band, not a blank card.
  const layout: PassLayout = needsPoster && !poster ? "BAND" : wanted;

  // A photo band whose photo would not load is drawn as the house band, not as
  // a shade over nothing.
  const theme =
    options.theme.stripStyle === "PHOTO" && !photo
      ? { ...options.theme, stripStyle: DEFAULT_PASS_THEME.stripStyle }
      : options.theme;

  // Strip on an event ticket is 375x98pt. Rendered at each scale rather than
  // upscaled, so the hatch and bar edges stay hard on a 3x screen.
  const render = (wanted: string | null) =>
    Promise.all([
      renderStrip(theme, intensity, badge, wanted, titleLabel, photo, 375, 98),
      renderStrip(theme, intensity, badge, wanted, titleLabel, photo, 750, 196),
      renderStrip(
        theme,
        intensity,
        badge,
        wanted,
        titleLabel,
        photo,
        1125,
        294,
      ),
    ]);

  const files: ImageSet = {
    ...brand,
    ...(logo ? await getUploadedLogoImages(logo) : {}),
  };
  let titleDrawn = false;

  // The blur layout has no band: Wallet lays the poster behind the whole pass
  // and a band would cover it. A themeless band would be a black bar over the
  // title rather than no band at all, so `NONE` omits the file entirely and
  // lets the pass fall back to its plain layout, and with no band there is
  // nowhere to set the name.
  const banded = layout !== "BLUR" && theme.stripStyle !== "NONE";
  if (banded) {
    let strips = await render(title);
    // All three scales or none: a name on the 2x artwork but not the 1x would
    // be a different pass depending on which phone opened it.
    if (title && strips.some((strip) => !strip.titleDrawn)) {
      strips = await render(null);
    }
    const [strip, strip2x, strip3x] = strips;
    files["strip.png"] = strip.image;
    files["strip@2x.png"] = strip2x.image;
    files["strip@3x.png"] = strip3x.image;
    titleDrawn = strips.every((item) => item.titleDrawn);
  }

  if (poster && layout === "BLUR") {
    Object.assign(
      files,
      await renderPhotoSet(poster, "background", BLUR_BACKGROUND, [2, 3]),
      await renderPhotoSet(poster, "thumbnail", THUMBNAIL, [1, 2, 3]),
    );
  }
  if (poster && layout === "POSTER") {
    Object.assign(
      files,
      await renderPhotoSet(poster, POSTER_ARTWORK_FILE, POSTER_ARTWORK, [2, 3]),
    );
  }

  const artwork: PassArtwork = {
    files,
    titleDrawn,
    posterDrawn: layout !== "BAND",
  };

  // Stand-in artwork for an upload that failed is not remembered, so the next
  // build tries the upload again instead of serving the stand-in for good.
  const degraded =
    (options.theme.stripStyle === "PHOTO" && !photo) ||
    (Boolean(options.logoImageId) && !logo) ||
    (needsPoster && Boolean(options.posterImageId) && !poster);
  return degraded ? artwork : remember(key, artwork);
}
