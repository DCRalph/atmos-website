import "server-only";

import Stripe from "stripe";

import { env } from "~/env";

/**
 * Stripe client, lazily constructed so the rest of the site still builds and
 * runs when Stripe keys are absent (local dev without ticketing, CI).
 * Anything that actually takes money calls `getStripe()` and gets a clear
 * error if the key is missing, rather than a confusing null dereference.
 */

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Ticket payments are unavailable.",
    );
  }
  client ??= new Stripe(env.STRIPE_SECRET_KEY, {
    // The SDK's pinned version is what these types are generated against;
    // overriding it here would only invite a mismatch.
    typescript: true,
    appInfo: { name: "Atmos Ticketing" },
  });
  return client;
}

export function isStripeConfigured(): boolean {
  return Boolean(
    env.STRIPE_SECRET_KEY && env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  );
}

/** True when the configured key is a test-mode key, for the admin warning banner. */
export function isStripeTestMode(): boolean {
  return env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ?? false;
}

/**
 * Who paid and how, as Stripe saw it. Shared by every path that issues a paid
 * order (webhook, instant confirm, cron rescue) so they all save the same fields.
 *
 * Phone and address only exist when a wallet supplied them: Express Checkout
 * asks Apple Pay / Google Pay / Link for both, the card form asks for neither.
 */
export function buyerFromCharge(
  intent: Stripe.PaymentIntent,
  charge: Stripe.Charge | null,
) {
  const billing = charge?.billing_details;
  return {
    buyerEmail: intent.receipt_email ?? billing?.email ?? null,
    buyerName: billing?.name ?? null,
    buyerPhone: billing?.phone ?? null,
    buyerAddress: formatAddress(billing?.address),
    paidWith: paidWithFromCharge(charge),
  };
}

/**
 * How a charge was paid: the wallet when there was one (`apple_pay`,
 * `google_pay`, `link`), otherwise Stripe's method type (`card`, `link`,
 * `card_present` for a card tapped at the door). Labelled by `paidWithLabel`.
 */
export function paidWithFromCharge(charge: Stripe.Charge | null) {
  const details = charge?.payment_method_details;
  if (!details) return null;
  const wallet =
    details.card?.wallet?.type ?? details.card_present?.wallet?.type;
  return wallet && wallet !== "unknown" ? wallet : details.type;
}

/**
 * One line, in the order you'd write it on an envelope. Null when there's no
 * street line: Apple Pay without a contact request still sends a postcode and
 * country, which isn't an address worth keeping.
 */
function formatAddress(address: Stripe.Address | null | undefined) {
  if (!address?.line1) return null;
  return [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postal_code,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
}

/** A payment in the Stripe dashboard, in test or live mode to match the key. */
export function stripePaymentUrl(paymentIntentId: string): string {
  const mode = isStripeTestMode() ? "test/" : "";
  return `https://dashboard.stripe.com/${mode}payments/${paymentIntentId}`;
}
