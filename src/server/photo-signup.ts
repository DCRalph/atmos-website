import "server-only";

import { createHash } from "node:crypto";
import { cache } from "react";

import { FileUploadStatus, GigStatus, type Prisma } from "~Prisma/client";
import { gigPath } from "~/lib/gig-url";
import { getMediaDisplayUrl } from "~/lib/media-url";
import { SITE_URL } from "~/lib/seo-constants";
import { formatEventDateLong } from "~/lib/ticketing/dates";
import { escapeHtml, sendEmailBatch } from "~/server/email/send";
import { resolveGigId } from "~/server/gig-lookup";
import { db } from "~/server/db";

/**
 * Gig photo signup, outside the router: what the public page draws, and the
 * "photos are up" email. The page is `/gigs/[id]/photo-signup`; signing up and
 * the admin side are the `photoSignup` router.
 */

/** Resend takes at most 100 emails per batch call. */
const BATCH_SIZE = 100;

/** A gig's photos, gallery order. Legacy ones have a `url` and no file. */
const PHOTOS = {
  where: { type: "photo" },
  orderBy: [{ section: "asc" }, { sortOrder: "asc" }],
  select: { fileUploadId: true, url: true },
} satisfies Prisma.Gig$mediaArgs;

/**
 * A photo for an email, scaled by the site's image optimiser so a mail client
 * never pulls the full-size file. Absolute, since it is opened from an inbox.
 */
function emailImage(photo: {
  fileUploadId: string | null;
  url: string | null;
}) {
  const source = new URL(getMediaDisplayUrl(photo), SITE_URL).toString();
  return `${SITE_URL}/_next/image?url=${encodeURIComponent(source)}&w=640&q=75`;
}

/**
 * The gig a signup page is for, by cuid or title slug, with what the page
 * draws. Null for anything not on the public site, and for a TBA gig: there
 * are no photos of a night nobody knows about yet. Cached per request, since
 * the page's metadata asks too.
 */
export const photoSignupGig = cache(async (idOrSlug: string) => {
  const published = { status: GigStatus.PUBLISHED };
  const gigId = await resolveGigId(db, idOrSlug, published);
  const gig = gigId
    ? await db.gig.findFirst({
        where: { id: gigId, ...published, isTba: false },
        select: {
          id: true,
          title: true,
          subtitle: true,
          gigStartTime: true,
          posterFileUploadId: true,
          _count: { select: { media: { where: { type: "photo" } } } },
        },
      })
    : null;
  if (!gig) return null;

  const poster = gig.posterFileUploadId
    ? await db.file_upload.findFirst({
        where: { id: gig.posterFileUploadId, status: FileUploadStatus.OK },
        select: { url: true },
      })
    : null;

  return {
    id: gig.id,
    title: gig.title,
    venue: gig.subtitle,
    startsAt: gig.gigStartTime,
    posterUrl: poster?.url ?? null,
    /** Once there are any, the page sends people to them instead. */
    hasPhotos: gig._count.media > 0,
    galleryHref: `${gigPath(gig)}#photos`,
  };
});

/** The "photos are up" email. One template for every recipient. */
function renderPhotosEmail(gig: {
  title: string;
  venue: string;
  startsAt: Date;
  photos: { fileUploadId: string | null; url: string | null }[];
  galleryUrl: string;
}) {
  const title = escapeHtml(gig.title);
  const when = `${formatEventDateLong(gig.startsAt)}, ${gig.venue}`;
  const thumbs = gig.photos
    .slice(0, 4)
    .map(
      (photo) =>
        `<td width="50%" style="padding:2px;"><a href="${escapeHtml(gig.galleryUrl)}"><img src="${escapeHtml(emailImage(photo))}" width="296" alt="" style="display:block;width:100%;height:auto;border:0;"></a></td>`,
    );
  const rows = [thumbs.slice(0, 2), thumbs.slice(2, 4)]
    .filter((row) => row.length)
    .map((row) => `<tr>${row.join("")}</tr>`)
    .join("");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>The photos from ${title} are up</title>
</head>
<body style="margin:0;padding:0;background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="padding:8px 0 24px;">
  <img src="${SITE_URL}/email/atmos-logo.png" width="160" height="36" alt="ATMOS" style="display:block;width:160px;height:auto;border:0;">
</td></tr>
<tr><td style="padding:0 0 18px;">
  <div style="font-size:30px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;margin-bottom:10px;">The photos are up</div>
  <div style="font-size:15px;color:#999;line-height:1.7;">${title}<br>${escapeHtml(when)}</div>
</td></tr>
${rows ? `<tr><td style="padding:0 0 18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>` : ""}
<tr><td style="padding:0 0 18px;">
  <a href="${escapeHtml(gig.galleryUrl)}" style="display:inline-block;padding:14px 22px;background:#c6ff33;color:#000;text-decoration:none;font-size:15px;font-weight:700;border-radius:999px;">See the photos</a>
</td></tr>
<tr><td style="padding:24px 0 8px;color:#999;font-size:12px;line-height:1.6;">
You asked to hear when the photos from ${title} were up.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    "The photos are up",
    "",
    gig.title,
    when,
    "",
    `See them: ${gig.galleryUrl}`,
    "",
    `You asked to hear when the photos from ${gig.title} were up.`,
  ].join("\n");

  return { subject: `The photos from ${gig.title} are up`, html, text };
}

/**
 * Email everybody signed up to this gig who has not had the email yet, and
 * mark them as sent. Safe to run again: only the unsent get anything, which is
 * also how a late signup gets theirs.
 *
 * A batch that fails stays unsent and is counted in `failed`. Each batch's
 * idempotency key is its recipients, so a doubled click sends a batch once.
 */
export async function sendPhotosEmail(gigId: string) {
  const gig = await db.gig.findUniqueOrThrow({
    where: { id: gigId },
    select: {
      id: true,
      title: true,
      subtitle: true,
      gigStartTime: true,
      isTba: true,
      media: PHOTOS,
    },
  });
  const pending = await db.gigPhotoSignup.findMany({
    where: { gigId, notifiedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });

  const email = renderPhotosEmail({
    title: gig.title,
    venue: gig.subtitle,
    startsAt: gig.gigStartTime,
    photos: gig.media,
    galleryUrl: `${SITE_URL}${gigPath(gig)}#photos`,
  });

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const key = createHash("sha256")
      .update(batch.map((row) => row.id).join(","))
      .digest("hex");
    const result = await sendEmailBatch(
      batch.map((row) => ({ from: "gigs", to: row.email, ...email })),
      { idempotencyKey: `gig-photos/${gigId}/${key}` },
    );

    if (!result.ok) {
      console.error("[photo-signup] batch failed", result.error);
      failed += batch.length;
      continue;
    }
    await db.gigPhotoSignup.updateMany({
      where: { id: { in: batch.map((row) => row.id) } },
      data: { notifiedAt: new Date() },
    });
    sent += batch.length;
  }

  return { sent, failed };
}
