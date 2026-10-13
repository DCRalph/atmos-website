import { LegalPage } from "~/components/site/legal/legal-page";
import { donationTermsDoc } from "~/components/site/legal/legal-docs";
import { pageMetadata } from "~/lib/seo-constants";

export const metadata = pageMetadata({
  title: "Donation terms",
  description:
    "The terms for donating to an Atmos gig, including payment, receipts and refunds.",
  path: "/legal/donation-terms",
});

export default function DonationTermsPage() {
  return <LegalPage doc={donationTermsDoc} />;
}
