/**
 * Generate the app icon set from the real logo.
 *
 *   node scripts/make-icons.mjs
 *
 * Source of truth is `public/logo/atmos-white.png` — the flat white wordmark on
 * transparency, the same file the app renders in its header. Everything here is
 * derived, so the icons cannot drift from the brand.
 *
 * The set this replaced was a bevelled chrome rendition of the wordmark with a
 * rounded rectangle and a drop shadow baked in. Both platforms mask icons
 * themselves, so a baked corner radius shows up as a rounded square floating
 * inside another one, and the shadow as a grey halo.
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const LOGO = resolve(here, "../../public/logo/atmos-white.png");
const OUT = resolve(here, "../assets");

const BLACK = { r: 0, g: 0, b: 0, alpha: 1 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };
const SIZE = 1024;

/**
 * The wordmark at `share` of the canvas width, centred on `background`.
 * `opaque` drops the alpha channel: the App Store rejects an icon that has one,
 * and a transparent icon renders black-on-black on a dark home screen.
 */
async function icon({ share, background, file, size = SIZE, opaque = false }) {
  const width = Math.round(SIZE * share);
  const logo = await sharp(LOGO).resize({ width }).toBuffer();
  const { height } = await sharp(logo).metadata();

  let out = sharp({
    create: { width: SIZE, height: SIZE, channels: 4, background },
  }).composite([
    {
      input: logo,
      left: Math.round((SIZE - width) / 2),
      top: Math.round((SIZE - height) / 2),
    },
  ]);

  if (size !== SIZE) out = sharp(await out.png().toBuffer()).resize(size, size);
  if (opaque) out = out.removeAlpha();

  await out.png().toFile(resolve(OUT, file));
  return height;
}

const height = await icon({
  share: 0.8,
  background: BLACK,
  file: "icon.png",
  opaque: true,
});

// Splash draws with `resizeMode: contain` on black, so it needs room around it.
await icon({ share: 0.7, background: CLEAR, file: "splash-icon.png" });

/**
 * Android masks adaptive icons to a shape it chooses, up to a circle, so only
 * the central ~61% of the canvas is guaranteed visible. A wordmark this wide
 * has to sit well inside that or the circle clips the A and the S.
 */
await icon({ share: 0.55, background: CLEAR, file: "android-icon-foreground.png" });

// Android 13+ tints this to the user's wallpaper, so it must be a flat
// silhouette. The source is already solid white on transparency.
await icon({ share: 0.55, background: CLEAR, file: "android-icon-monochrome.png" });

await sharp({
  create: { width: SIZE, height: SIZE, channels: 4, background: BLACK },
})
  .png()
  .toFile(resolve(OUT, "android-icon-background.png"));

await icon({
  share: 0.85,
  background: BLACK,
  file: "favicon.png",
  size: 196,
  opaque: true,
});

console.log(`wordmark is ${height}px tall at 80% of ${SIZE} — icons written`);
