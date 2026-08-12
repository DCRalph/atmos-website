import { TRPCError } from "@trpc/server";

import { createTRPCRouter, doorProcedure } from "~/server/api/trpc";
import { getStripe, isStripeConfigured } from "~/server/stripe";
import { env } from "~/env";

/**
 * Stripe Terminal plumbing for Tap to Pay.
 *
 * The SDK will not talk to Stripe until the app hands it a connection token,
 * and that token can only be minted with the secret key — which is the whole
 * point: it is what stops a decompiled app from acting as a reader on this
 * account. It is short-lived and the SDK asks for a fresh one whenever it
 * needs to.
 *
 * `doorProcedure` guards it, so only somebody already rostered on a door can
 * mint one at all.
 */
export const terminalRouter = createTRPCRouter({
  connectionToken: doorProcedure.mutation(async () => {
    if (!isStripeConfigured()) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Card payments aren't set up yet.",
      });
    }

    const stripe = getStripe();
    const token = await stripe.terminal.connectionTokens.create(
      // A Location scopes which readers a token may drive. Tap to Pay uses the
      // phone itself, so this only matters for reporting — but Stripe requires
      // the account to have one, and pinning it keeps door takings grouped.
      env.STRIPE_TERMINAL_LOCATION_ID
        ? { location: env.STRIPE_TERMINAL_LOCATION_ID }
        : {},
    );

    return { secret: token.secret };
  }),

  /** Whether the door should offer Tap to Pay at all. */
  config: doorProcedure.query(() => {
    return {
      available: isStripeConfigured(),
      locationId: env.STRIPE_TERMINAL_LOCATION_ID ?? null,
    };
  }),
});
