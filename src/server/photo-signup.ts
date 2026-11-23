import "server-only";

import { createHash } from "node:crypto";
import { cache } from "react";

import { FileUploadStatus, GigStatus, type Prisma } from "~Prisma/client";
import { gigPath } from "~/lib/gig-url";
import { getMediaDisplayUrl } from "~/lib/media-url";
import { SITE_URL } from "~/lib/seo-constants";
import { renderPhotosEmail } from "~/emails/photos";
import { sendEmailBatch } from "~/server/email/send";
import { resolveGigId } from "~/server/gig-lookup";
import { db } from "~/server/db";
import { gigOgImage } from "~/server/og-image";

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
          slug: true,
          title: true,
          subtitle: true,
          gigStartTime: true,
          isTba: true,
          posterFileUploadId: true,
          widePosterFileUploadId: true,
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
    slug: gig.slug,
    title: gig.title,
    venue: gig.subtitle,
    startsAt: gig.gigStartTime,
    posterUrl: poster?.url ?? null,
    /** The link preview image, for the page's metadata. */
    ogImage: gigOgImage(gig),
    /** Once there are any, the page sends people to them instead. */
    hasPhotos: gig._count.media > 0,
    galleryHref: `${gigPath(gig)}#photos`,
  };
});

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
      slug: true,
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
    thumbnails: gig.media.map(emailImage),
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
