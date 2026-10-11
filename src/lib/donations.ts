import { z } from "zod";

/**
 * Gig donations: the rules the editor, the donate page and the checkout all
 * hold to. Client-safe. Amounts are integer cents, like the rest of the money.
 */

/** Stripe's NZD floor is 50c. A dollar keeps the fee from eating the gift. */
export const MIN_DONATION_CENTS = 100;
/** A typo guard, not a policy. */
export const MAX_DONATION_CENTS = 1_000_000;

/** What a gig's three suggestions start as. Matches the column default. */
export const DEFAULT_DONATION_AMOUNTS_CENTS = [1000, 2000, 5000];

export const donationCentsSchema = z
  .number()
  .int()
  .min(MIN_DONATION_CENTS, "The smallest donation is $1")
  .max(MAX_DONATION_CENTS, "The largest donation is $10,000");

/** Exactly three suggestions, in the order the page shows them. */
export const donationAmountsSchema = z.array(donationCentsSchema).length(3);

/** Which suggestion is recommended, or null for none. */
export const donationRecommendedSchema = z
  .number()
  .int()
  .min(0)
  .max(2)
  .nullable();
