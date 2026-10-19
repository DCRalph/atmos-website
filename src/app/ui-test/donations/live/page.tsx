import { notFound } from "next/navigation";
import { type Metadata } from "next";

import "~/styles/site.css";
import { DonatePage } from "~/components/site/gigs/donate-page";
import { siteFontVariables } from "~/lib/site-fonts";
import { upcomingGigs } from "../../design/fixtures";

export const metadata: Metadata = {
  title: "Donation page preview",
  robots: { index: false, follow: false },
};

/** The production page with fixture data; payment confirmation is simulated. */
export default async function LiveDonationPreview({
  searchParams,
}: PageProps<"/ui-test/donations/live">) {
  if (process.env.NODE_ENV === "production") return notFound();
  const query = await searchParams;
  const sample = upcomingGigs[0];
  const amount = Number(query.amount ?? 2500);
  const gig: Parameters<typeof DonatePage>[0]["gig"] = {
    id: "ui-test-donation",
    title: sample.title,
    venue: sample.venue,
    startsAt: sample.date,
    posterUrl: query.poster === "none" ? null : sample.poster,
    ogImage: null,
    amountsCents: [500, 1500, 2500, 5000],
    recommendedIndex: 2,
    description: null,
    gigHref: `/gigs/${sample.slug}`,
  };

  return (
    <div className={`site ${siteFontVariables}`}>
      <DonatePage
        gig={gig}
        thankedCents={
          query.state === "unpaid"
            ? null
            : Number.isSafeInteger(amount) && amount > 0
              ? amount
              : 2500
        }
      />
    </div>
  );
}
