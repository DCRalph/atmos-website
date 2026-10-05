import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";
import { env } from "~/env";

/**
 * A TBA gig's poster as the public gets it: blurred on the server.
 *
 * The real poster has to stay off the client entirely. Its file id opens it at
 * `/api/media/<id>`, and its R2 URL opens it directly, so a CSS blur over
 * either is a blur anybody can switch off in devtools.
 */

/**
 * How wide the poster is shrunk to. This is what throws the detail away: at
 * 24 a big headline was still half legible, at 10 only colour and layout are
 * left.
 */
const TEASER_SOURCE_WIDTH = 10;
/** How wide the teaser is served, so it scales up smoothly instead of in blocks. */
const TEASER_WIDTH = 480;

/**
 * Where the teaser for this gig's poster is served from.
 *
 * `v` changes when the poster does, so the route can cache forever. It is a
 * hash rather than the file id because the id is the thing being kept secret.
 */
export const teaserPosterUrl = (
  gigId: string,
  posterFileUploadId: string,
): string => {
  const version = createHash("sha256")
    .update(posterFileUploadId)
    .digest("hex")
    .slice(0, 12);
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${base}/api/gigs/${gigId}/teaser?v=${version}`;
};

/** Shrinks the poster to ten pixels wide, then blurs it back up to size. */
export async function renderTeaser(poster: Buffer): Promise<Buffer> {
  const tiny = await sharp(poster)
    .rotate()
    .resize({ width: TEASER_SOURCE_WIDTH })
    .toBuffer();
  return sharp(tiny)
    .resize({ width: TEASER_WIDTH })
    .blur(24)
    .webp({ quality: 70 })
    .toBuffer();
}
