import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";

import { env } from "~/env";
import { db } from "~/server/db";
import { getObjectBuffer } from "~/server/uploads/r2";
import { FileUploadStatus, GigStatus, TicketEventStatus } from "~Prisma/client";

/**
 * Link preview images for gigs and ticket events: what iMessage, WhatsApp,
 * Slack and the rest show when one of their links is shared.
 *
 * Posters are portrait and previews are landscape, so a raw poster gets its
 * top and bottom cropped off. A wide poster is used as it is. Otherwise the
 * poster sits whole on a blurred copy of itself, like the donate page. A TBA
 * gig only ever gets the blur, since its poster is the secret.
 *
 * Rendered by `/api/og/[kind]/[id]` and cached forever under a version that
 * changes when the posters do.
 */

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** What a preview is drawn from. */
type OgSource =
  | { mode: "wide"; key: string }
  | { mode: "poster"; key: string }
  | { mode: "teaser"; key: string };

export type OgKind = "gig" | "event";

/**
 * The preview image for a page's metadata, or null when there's no poster to
 * make one from. `v` is a hash rather than the file ids, because a TBA gig's
 * poster id opens the unblurred poster.
 */
function ogImage(kind: OgKind, id: string, alt: string, parts: unknown[]) {
  const version = createHash("sha256")
    .update(JSON.stringify(parts))
    .digest("hex")
    .slice(0, 12);
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return {
    url: `${base}/api/og/${kind}/${id}?v=${version}`,
    width: OG_WIDTH,
    height: OG_HEIGHT,
    alt,
    type: "image/jpeg",
  };
}

/** A gig's preview image. */
export function gigOgImage(gig: {
  id: string;
  title: string;
  isTba: boolean;
  posterFileUploadId: string | null;
  widePosterFileUploadId: string | null;
}) {
  const wide = gig.isTba ? null : gig.widePosterFileUploadId;
  if (!wide && !gig.posterFileUploadId) return null;
  return ogImage("gig", gig.id, gig.isTba ? "Atmos" : gig.title, [
    gig.posterFileUploadId,
    wide,
    gig.isTba,
  ]);
}

/**
 * A ticket event's preview image: its own poster, otherwise its gig's, the
 * same as `eventPosterId`. Never from a TBA gig.
 */
export function eventOgImage(event: {
  id: string;
  name: string;
  posterFileUploadId: string | null;
  gig: {
    isTba: boolean;
    posterFileUploadId: string | null;
    widePosterFileUploadId: string | null;
  } | null;
}) {
  const gig = event.gig?.isTba ? null : event.gig;
  const parts = event.posterFileUploadId
    ? [event.posterFileUploadId]
    : [gig?.widePosterFileUploadId ?? null, gig?.posterFileUploadId ?? null];
  if (parts.every((part) => !part)) return null;
  return ogImage("event", event.id, event.name, parts);
}

/** The storage key of a live file, or null. */
async function fileKey(id: string | null): Promise<string | null> {
  if (!id) return null;
  const file = await db.file_upload.findUnique({
    where: { id, status: FileUploadStatus.OK },
    select: { key: true },
  });
  return file?.key ?? null;
}

/** What to draw a gig's preview from. Null for a draft or a gig with no poster. */
export async function gigOgSource(id: string): Promise<OgSource | null> {
  const gig = await db.gig.findFirst({
    where: { id, status: GigStatus.PUBLISHED },
    select: {
      isTba: true,
      posterFileUploadId: true,
      widePosterFileUploadId: true,
    },
  });
  if (!gig) return null;

  const poster = await fileKey(gig.posterFileUploadId);
  if (gig.isTba) return poster ? { mode: "teaser", key: poster } : null;
  const wide = await fileKey(gig.widePosterFileUploadId);
  if (wide) return { mode: "wide", key: wide };
  return poster ? { mode: "poster", key: poster } : null;
}

/**
 * What to draw a ticket event's preview from. Any event that isn't a draft or
 * archived: a private event's id only reaches somebody holding its link.
 */
export async function eventOgSource(id: string): Promise<OgSource | null> {
  const event = await db.ticketEvent.findFirst({
    where: {
      id,
      status: {
        notIn: [TicketEventStatus.DRAFT, TicketEventStatus.ARCHIVED],
      },
    },
    select: {
      posterFileUploadId: true,
      gig: {
        select: {
          isTba: true,
          posterFileUploadId: true,
          widePosterFileUploadId: true,
        },
      },
    },
  });
  if (!event) return null;

  const own = await fileKey(event.posterFileUploadId);
  if (own) return { mode: "poster", key: own };
  if (!event.gig || event.gig.isTba) return null;
  const wide = await fileKey(event.gig.widePosterFileUploadId);
  if (wide) return { mode: "wide", key: wide };
  const poster = await fileKey(event.gig.posterFileUploadId);
  return poster ? { mode: "poster", key: poster } : null;
}

/** Room left around a portrait poster on its blurred backdrop. */
const INSET = 44;
const RADIUS = 18;

/** Draws a preview as a 1200x630 JPEG. */
export async function renderOgImage(source: OgSource): Promise<Buffer> {
  return drawOgImage(source.mode, await getObjectBuffer(source.key));
}

/** The drawing half of `renderOgImage`, from the image's bytes. */
export async function drawOgImage(
  mode: OgSource["mode"],
  image: Buffer,
): Promise<Buffer> {
  const cover = { width: OG_WIDTH, height: OG_HEIGHT, fit: "cover" } as const;

  if (mode === "wide") {
    return sharp(image).rotate().resize(cover).jpeg({ quality: 85 }).toBuffer();
  }

  // Shrunk to a few pixels first, so the blur keeps colour and nothing else.
  // For a TBA gig that is the point; for the rest it is just a soft backdrop.
  const tiny = await sharp(image)
    .rotate()
    .resize({ width: mode === "teaser" ? 10 : 48 })
    .toBuffer();
  const backdrop = sharp(tiny)
    .resize(cover)
    .blur(mode === "teaser" ? 40 : 24)
    .modulate({ brightness: mode === "teaser" ? 0.8 : 0.5 });
  if (mode === "teaser") {
    return backdrop.jpeg({ quality: 80 }).toBuffer();
  }

  const poster = await sharp(image)
    .rotate()
    .resize({
      width: OG_WIDTH - INSET * 2,
      height: OG_HEIGHT - INSET * 2,
      fit: "inside",
    })
    .toBuffer({ resolveWithObject: true });
  const { width, height } = poster.info;
  const corners = Buffer.from(
    `<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${RADIUS}" ry="${RADIUS}"/></svg>`,
  );
  const rounded = await sharp(poster.data)
    .composite([{ input: corners, blend: "dest-in" }])
    .png()
    .toBuffer();

  return backdrop
    .composite([
      {
        input: rounded,
        left: Math.round((OG_WIDTH - width) / 2),
        top: Math.round((OG_HEIGHT - height) / 2),
      },
    ])
    .jpeg({ quality: 85 })
    .toBuffer();
}
