import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { GigStatus } from "~Prisma/client";
import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";
import {
  DONATION_PAYMENT_METHODS,
  donationCentsSchema,
  summariseDonations,
} from "~/lib/donations";
import { paidDonationCents } from "~/server/donations";
import { chargeReceiptUrl, getStripe, stripePaymentUrl } from "~/server/stripe";
import { enforceRateLimit } from "~/server/ticketing/rate-limit";

/**
 * Gig donations. The page is `/gigs/[id]/donate`; see `~/server/donations.ts`.
 */
export const donationsRouter = createTRPCRouter({
  /**
   * Open a payment intent for a donation and hand back its client secret.
   * The donate page collects the card or wallet itself with Stripe Elements
   * and asks for this only once the visitor taps pay, so the amount is final
   * and nothing is left half open while they decide.
   *
   * The intent is tagged `kind: "donation"`, which is how the webhook and
   * `confirm` know to record it as a `Donation`.
   */
  intent: publicProcedure
    .input(
      z.object({
        gigId: z.string(),
        amountCents: donationCentsSchema,
        /** Where Stripe sends the receipt, from the wallet or the card form. */
        email: z.email().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ip =
        ctx.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      await enforceRateLimit({
        key: `donate:${ip}`,
        limit: 20,
        windowSeconds: 600,
      });

      const gig = await ctx.db.gig.findFirst({
        where: {
          id: input.gigId,
          status: GigStatus.PUBLISHED,
          isTba: false,
          donationsEnabled: true,
        },
        select: { id: true, title: true },
      });
      if (!gig) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This gig isn't taking donations.",
        });
      }

      let clientSecret: string | null;
      try {
        const intent = await getStripe().paymentIntents.create({
          amount: input.amountCents,
          currency: "nzd",
          payment_method_types: [...DONATION_PAYMENT_METHODS],
          metadata: { kind: "donation", gigId: gig.id },
          description: `Donation: ${gig.title}`,
          receipt_email: input.email,
        });
        clientSecret = intent.client_secret;
      } catch (cause) {
        // Stripe's own errors are for us, not for somebody giving money.
        console.error("[donations] payment intent failed", cause);
        clientSecret = null;
      }

      if (!clientSecret) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Couldn't start the payment. Try again in a moment.",
        });
      }
      return { clientSecret };
    }),

  /**
   * Record a donation the page just paid and say how much it was, so the
   * thank you shows without waiting on the webhook. Null when Stripe doesn't
   * agree it's a paid donation for this gig.
   */
  confirm: publicProcedure
    .input(z.object({ gigId: z.string(), paymentIntentId: z.string() }))
    .mutation(({ input }) =>
      paidDonationCents(input.paymentIntentId, input.gigId),
    ),

  /** One gig's donations and what they add up to, for its editor tab. */
  forGig: adminProcedure
    .input(z.object({ gigId: z.string() }))
    .query(async ({ ctx, input }) => {
      const gig = await ctx.db.gig.findUnique({
        where: { id: input.gigId },
        select: {
          donationsEnabled: true,
          donationAmountsCents: true,
          donationRecommendedIndex: true,
          donations: {
            orderBy: { paidAt: "desc" },
            select: {
              id: true,
              amountCents: true,
              refundedCents: true,
              donorName: true,
              donorEmail: true,
              paidAt: true,
              paidWith: true,
              stripePaymentIntentId: true,
            },
          },
        },
      });
      if (!gig) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Gig not found" });
      }

      return {
        enabled: gig.donationsEnabled,
        recommendedIndex: gig.donationRecommendedIndex,
        summary: summariseDonations(gig.donations, gig.donationAmountsCents),
        donations: gig.donations.map(
          ({ stripePaymentIntentId, ...donation }) => ({
            ...donation,
            stripeUrl: stripePaymentUrl(stripePaymentIntentId),
          }),
        ),
      };
    }),

  /** One donation, everything recorded about it, for its admin dialog. */
  donation: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const donation = await ctx.db.donation.findUnique({
        where: { id: input.id },
        include: { gig: { select: { id: true, title: true } } },
      });
      if (!donation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Donation not found",
        });
      }
      return {
        ...donation,
        stripeUrl: stripePaymentUrl(donation.stripePaymentIntentId),
      };
    }),

  /**
   * The donor's Stripe receipt. Its own query because it asks Stripe live,
   * like `ticketAdmin.stripeReceiptUrl` for orders.
   */
  stripeReceiptUrl: adminProcedure
    .input(z.object({ donationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const donation = await ctx.db.donation.findUnique({
        where: { id: input.donationId },
        select: { stripeChargeId: true },
      });
      return chargeReceiptUrl(donation?.stripeChargeId ?? null);
    }),
});
