import "server-only";

import { cache } from "react";
import type Stripe from "stripe";

import { FileUploadStatus, GigStatus } from "~Prisma/client";
import { gigPath } from "~/lib/gig-url";
import { lexicalToPlainText } from "~/lib/gig-import/lexical";
import { resolveGigId } from "~/server/gig-lookup";
import { db } from "~/server/db";
import { buyerFromCharge, getStripe } from "~/server/stripe";

/**
 * Gig donations, outside the router: what `/gigs/[id]/donate` draws, and
 * recording the paid ones. Taking the money is `donations.checkout`.
 *
 * A donation is a Stripe Checkout payment whose payment intent carries
 * `kind: "donation"` and the gig. It becomes a `Donation` row when paid.
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
          donationRecommendedIndex: true,
          donationDescriptionLexical: true,
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
    /** Index into `amountsCents`, or null for no recommendation. */
    recommendedIndex: gig.donationRecommendedIndex,
    /** The admin's words above the amounts. Null when there are none. */
    description: lexicalToPlainText(gig.donationDescriptionLexical)
      ? gig.donationDescriptionLexical
      : null,
    gigHref: gigPath(gig),
  };
});

/** True for a payment intent `donations.checkout` started. */
export const isDonationIntent = (intent: Stripe.PaymentIntent) =>
  intent.metadata?.kind === "donation";

/**
 * Write the donation for a paid intent. Idempotent on the intent id, so the
 * webhook and the visitor's return can both call it and only one row lands.
 */
export async function recordDonation(intent: Stripe.PaymentIntent) {
  const charge =
    typeof intent.latest_charge === "string"
      ? await getStripe().charges.retrieve(intent.latest_charge)
      : (intent.latest_charge ?? null);
  const buyer = buyerFromCharge(intent, charge);
  const gigId = intent.metadata?.gigId ?? null;
  // A gig deleted while the visitor was on Stripe's page keeps the money.
  const gig = gigId
    ? await db.gig.findUnique({ where: { id: gigId }, select: { id: true } })
    : null;

  return db.donation.upsert({
    where: { stripePaymentIntentId: intent.id },
    create: {
      gigId: gig?.id ?? null,
      amountCents: intent.amount_received,
      currency: intent.currency.toUpperCase(),
      stripePaymentIntentId: intent.id,
      stripeChargeId: charge?.id ?? null,
      donorEmail: buyer.buyerEmail,
      donorName: buyer.buyerName,
      paidAt: new Date((charge?.created ?? intent.created) * 1000),
    },
    update: {},
  });
}

/**
 * How much the visitor gave, when Stripe sends them back with a paid session
 * for this gig. Records it on the way, in case the webhook is slow. Null for
 * anything else: an unpaid or foreign session, a stale id, or Stripe being
 * unreachable, all of which just show the ask again.
 */
export async function paidDonationCents(
  sessionId: string,
  gigId: string,
): Promise<number | null> {
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });
    const intent = session.payment_intent;
    if (
      session.payment_status !== "paid" ||
      session.metadata?.gigId !== gigId ||
      !intent ||
      typeof intent === "string"
    ) {
      return null;
    }
    const donation = await recordDonation(intent);
    return donation.amountCents;
  } catch (cause) {
    console.error("[donations] couldn't confirm a return", cause);
    return null;
  }
}
