import "server-only";

import { cache } from "react";
import type Stripe from "stripe";

import { FileUploadStatus, GigStatus } from "~Prisma/client";
import { gigPath } from "~/lib/gig-url";
import { lexicalToPlainText } from "~/lib/gig-import/lexical";
import { resolveGigId } from "~/server/gig-lookup";
import { db } from "~/server/db";
import { gigOgImage } from "~/server/og-image";
import { buyerFromCharge, getStripe } from "~/server/stripe";

/**
 * Gig donations, outside the router: what `/gigs/[id]/donate` draws, and
 * recording the paid ones. Taking the money is `donations.intent`.
 *
 * A donation is a payment intent paid on the donate page itself, carrying
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
          isTba: true,
          posterFileUploadId: true,
          widePosterFileUploadId: true,
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
    /** The link preview image, for the page's metadata. */
    ogImage: gigOgImage(gig),
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

/** True for a payment intent `donations.intent` started. */
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
 * How much a donation intent for this gig was paid, recording it on the way
 * in case the webhook is slow. Called when the page confirms a payment inline,
 * and when a redirecting payment method sends the visitor back with
 * `?payment_intent=`. Null for anything else: unpaid, another gig's or not a
 * donation, a stale id, or Stripe being unreachable, all of which just show
 * the ask again.
 */
export async function paidDonationCents(
  paymentIntentId: string,
  gigId: string,
): Promise<number | null> {
  try {
    const intent = await getStripe().paymentIntents.retrieve(paymentIntentId);
    if (
      intent.status !== "succeeded" ||
      !isDonationIntent(intent) ||
      intent.metadata.gigId !== gigId
    ) {
      return null;
    }
    const donation = await recordDonation(intent);
    return donation.amountCents;
  } catch (cause) {
    console.error("[donations] couldn't confirm a payment", cause);
    return null;
  }
}
