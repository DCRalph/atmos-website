import "server-only";

import { cache } from "react";

import { FileUploadStatus, GigStatus } from "~Prisma/client";
import { gigPath } from "~/lib/gig-url";
import { resolveGigId } from "~/server/gig-lookup";
import { db } from "~/server/db";
import { getStripe } from "~/server/stripe";

/**
 * Gig donations, outside the router: what `/gigs/[id]/donate` draws, and
 * whether the visitor just paid. Taking the money is `donations.checkout`.
 *
 * Nothing is stored here. A donation is a Stripe Checkout payment tagged with
 * the gig, so the Stripe dashboard is the record.
 */

/**
 * The gig a donate page is for, by cuid or title slug. Null unless the gig is
 * public, announced and taking donations. Cached per request, since the page's
 * metadata asks too.
 */
export const donateGig = cache(async (idOrSlug: string) => {
  const where = {
    status: GigStatus.PUBLISHED,
    isTba: false,
    donationsEnabled: true,
  };
  const gigId = await resolveGigId(db, idOrSlug, where);
  const gig = gigId
    ? await db.gig.findFirst({
        where: { id: gigId, ...where },
        select: {
          id: true,
          title: true,
          subtitle: true,
          gigStartTime: true,
          posterFileUploadId: true,
          donationAmountsCents: true,
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
    amountsCents: gig.donationAmountsCents,
    gigHref: gigPath(gig),
  };
});

/**
 * How much the visitor gave, when Stripe sends them back with a paid session
 * for this gig. Null for anything else: an unpaid or foreign session, a stale
 * id, or Stripe being unreachable, all of which just show the ask again.
 */
export async function paidDonationCents(
  sessionId: string,
  gigId: string,
): Promise<number | null> {
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const paid =
      session.payment_status === "paid" && session.metadata?.gigId === gigId;
    return paid ? session.amount_total : null;
  } catch {
    return null;
  }
}
