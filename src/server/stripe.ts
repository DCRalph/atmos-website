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
