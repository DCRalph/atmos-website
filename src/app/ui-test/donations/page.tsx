import { type Metadata } from "next";
import { notFound } from "next/navigation";

import "~/styles/site.css";
import { siteFontVariables } from "~/lib/site-fonts";
import { DonationBoard } from "./board";
import { experiences, sampleAmounts } from "./examples";

export const metadata: Metadata = {
  title: "Donation experiences",
  robots: { index: false, follow: false },
};

/** Three complete donation demos, with no Stripe or database access. Dev only. */
export default async function DonationExamplesPage({
  searchParams,
}: PageProps<"/ui-test/donations">) {
  if (process.env.NODE_ENV === "production") return notFound();

  const params = await searchParams;
  const initialExperience =
    experiences.find((experience) => experience.id === params.experience)?.id ??
    "soundwave";
  const initialAmountCents =
    sampleAmounts.find((amount) => String(amount) === params.amount) ?? 2500;

  return (
    <div className={`site ${siteFontVariables}`}>
      <DonationBoard
        initialExperience={initialExperience}
        initialAmountCents={initialAmountCents}
      />
    </div>
  );
}
