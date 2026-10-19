import { type Metadata } from "next";
import { notFound } from "next/navigation";

import "~/styles/site.css";
import { siteFontVariables } from "~/lib/site-fonts";
import { BasicThanks, DonationThanks } from "../experience";
import { experiences, sampleAmounts } from "../examples";

export const metadata: Metadata = {
  title: "Big love. Thank you",
  robots: { index: false, follow: false },
};

/** A separate destination for the demos, never a real payment confirmation. */
export default async function DonationThankYouPage({
  searchParams,
}: PageProps<"/ui-test/donations/thanks">) {
  if (process.env.NODE_ENV === "production") return notFound();
  const params = await searchParams;
  const experience =
    experiences.find((item) => item.id === params.experience)?.id ??
    "soundwave";
  const amountCents =
    sampleAmounts.find((amount) => String(amount) === params.amount) ?? 2500;

  return (
    <div className={`site ${siteFontVariables}`}>
      {experience === "basic" ? (
        <main className="min-h-dvh">
          <h1 className="sr-only">Donation thank you preview</h1>
          <BasicThanks
            amountCents={amountCents}
            reducedMotion={params.motion === "reduced"}
          />
        </main>
      ) : (
        <DonationThanks
          experience={experience}
          amountCents={amountCents}
          previewReducedMotion={params.motion === "reduced"}
        />
      )}
    </div>
  );
}
