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

/** What `summariseDonations` reads from a donation. */
type DonationFacts = {
  amountCents: number;
  refundedCents: number;
  donorEmail: string | null;
  paidAt: Date;
};

/**
 * One gig's donations as the editor's Donations tab shows them: the totals,
 * how often each suggestion was picked, and the running total over time.
 *
 * A donation counts as a pick of the first suggestion it matches, otherwise
 * as the donor's own amount. Suggestions edited after the fact move donations
 * into "own", which is the honest reading: nobody tapped the new number.
 */
export function summariseDonations(
  donations: DonationFacts[],
  suggestionsCents: number[],
) {
  const givenCents = donations.reduce((sum, d) => sum + d.amountCents, 0);
  const refundedCents = donations.reduce((sum, d) => sum + d.refundedCents, 0);

  // Anybody without an email counts as their own person.
  const emails = new Set<string>();
  let anonymous = 0;
  for (const d of donations) {
    if (d.donorEmail) emails.add(d.donorEmail.toLowerCase());
    else anonymous++;
  }

  const picks = [
    ...suggestionsCents.map((amountCents) => ({ amountCents, count: 0 })),
    { amountCents: null, count: 0 },
  ];
  for (const d of donations) {
    const index = suggestionsCents.indexOf(d.amountCents);
    const pick = picks[index === -1 ? suggestionsCents.length : index];
    if (pick) pick.count++;
  }
  const top = Math.max(...picks.map((pick) => pick.count));
  const mostPicked = top > 0 ? picks.findIndex((p) => p.count === top) : null;

  let running = 0;
  const cumulative = [...donations]
    .sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime())
    .map((d) => {
      running += d.amountCents - d.refundedCents;
      return { at: d.paidAt, cents: running };
    });

  return {
    givenCents,
    refundedCents,
    raisedCents: givenCents - refundedCents,
    count: donations.length,
    people: emails.size + anonymous,
    averageCents: donations.length
      ? Math.round(givenCents / donations.length)
      : 0,
    largestCents: Math.max(0, ...donations.map((d) => d.amountCents)),
    /** One per suggestion in order, then `amountCents: null` for their own. */
    picks,
    /** Index into `picks`, or null before anybody has given. */
    mostPicked,
    cumulative,
  };
}
