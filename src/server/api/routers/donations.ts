import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { GigStatus } from "~Prisma/client";
import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";
import { donationCentsSchema, summariseDonations } from "~/lib/donations";
import { gigPath } from "~/lib/gig-url";
import { SITE_URL } from "~/lib/seo-constants";
import { getStripe, stripePaymentUrl } from "~/server/stripe";
import { enforceRateLimit } from "~/server/ticketing/rate-limit";

/**
 * Gig donations. The page is `/gigs/[id]/donate`; see `~/server/donations.ts`.
 */
export const donationsRouter = createTRPCRouter({
  /**
   * Start a Stripe Checkout for a donation and hand back where to send the
   * visitor. Stripe's page takes the card or wallet and the email, then
   * returns them to the donate page with the session id to say thanks.
   *
   * The payment intent is tagged `kind: "donation"`, which is how the webhook
   * and the return page know to record it as a `Donation`.
   */
  checkout: publicProcedure
    .input(z.object({ gigId: z.string(), amountCents: donationCentsSchema }))
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

      const page = `${SITE_URL}${gigPath(gig)}/donate`;
      const metadata = { kind: "donation", gigId: gig.id };
      let url: string | null;
      try {
        const session = await getStripe().checkout.sessions.create({
          mode: "payment",
          submit_type: "donate",
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "nzd",
                unit_amount: input.amountCents,
                product_data: {
                  name: "Donation to Atmos",
                  description: gig.title,
                },
              },
            },
          ],
          metadata,
          payment_intent_data: {
            metadata,
            description: `Donation: ${gig.title}`,
          },
          success_url: `${page}?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: page,
        });
        url = session.url;
      } catch (cause) {
        // Stripe's own errors are for us, not for somebody giving money.
        console.error("[donations] checkout session failed", cause);
        url = null;
      }

      if (!url) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Couldn't start the payment. Try again in a moment.",
        });
      }
      return { url };
    }),

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
});
