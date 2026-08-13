import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, doorProcedure } from "~/server/api/trpc";
import { getStripe, isStripeConfigured } from "~/server/stripe";
import { env } from "~/env";

/** A test tap is a dollar, authorised and immediately voided. */
const TEST_CHARGE_CENTS = 100;

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

  /**
   * What the app needs to know before touching the Terminal SDK.
   *
   * Reaching this at all is the eligibility answer — `doorProcedure` refuses
   * everybody who is not rostered on a door, so the app does not carry a second
   * copy of that rule.
   */
  config: doorProcedure.query(({ ctx }) => {
    return {
      available: isStripeConfigured(),
      locationId: env.STRIPE_TERMINAL_LOCATION_ID ?? null,
      /**
       * May this person accept Apple's Tap to Pay Terms and Conditions on the
       * handset in their hand?
       *
       * Apple's App Review checklist 3.8 requires this to be an administrator
       * or otherwise authorized party, and 3.8.1 requires everybody else to be
       * told to go and find one. Admin only, deliberately: accepting binds the
       * Atmos merchant identity to that person's personal Apple Account, which
       * is a directorial act rather than an operational one — a per-event door
       * manager should not be able to do it on a borrowed phone.
       *
       * Decided here and not in the app: this is what gates
       * `tosAcceptancePermitted` on the connect call, so a patched client must
       * not be able to answer it for itself.
       */
      canAcceptTerms: ctx.isAdmin,
    };
  }),

  /**
   * A practice tap that costs nobody anything.
   *
   * Checklist 3.9 asks for a dedicated screen inviting the merchant to try Tap
   * to Pay once they have accepted the terms and been through the education —
   * and an invitation that cannot actually be taken up is not much of one.
   *
   * `capture_method: "manual"` is what makes it safe: the tap authorises a
   * dollar and `voidTestIntent` releases it immediately, so the card is
   * verified end to end without money ever moving. Anything left uncancelled
   * expires on Stripe's side within days rather than settling.
   */
  createTestIntent: doorProcedure.mutation(async ({ ctx }) => {
    if (!isStripeConfigured()) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Card payments aren't set up yet.",
      });
    }

    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: TEST_CHARGE_CENTS,
      currency: "nzd",
      payment_method_types: ["card_present"],
      capture_method: "manual",
      description: "Tap to Pay test — authorisation only, never captured",
      metadata: {
        channel: "tap-to-pay-test",
        testedByUserId: ctx.user.id,
      },
    });

    return {
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      amountCents: TEST_CHARGE_CENTS,
    };
  }),

  /** Release the practice authorisation. Safe to call more than once. */
  voidTestIntent: doorProcedure
    .input(z.object({ paymentIntentId: z.string() }))
    .mutation(async ({ input }) => {
      if (!isStripeConfigured()) return { ok: true as const };

      const stripe = getStripe();
      const intent = await stripe.paymentIntents.retrieve(input.paymentIntentId);

      // Only ever touch the intents this router made, so a stray id cannot be
      // used to cancel a real door sale mid-tap.
      if (intent.metadata?.channel !== "tap-to-pay-test") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That isn't a test payment.",
        });
      }

      if (intent.status === "canceled") return { ok: true as const };

      await stripe.paymentIntents.cancel(input.paymentIntentId);
      return { ok: true as const };
    }),
});
