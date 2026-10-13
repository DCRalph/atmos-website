import { LegalPage } from "~/components/site/legal/legal-page";
import { termsDoc } from "~/components/site/legal/legal-docs";
import { pageMetadata } from "~/lib/seo-constants";

export const metadata = pageMetadata({
  title: "Terms",
  description:
    "The terms for using the Atmos website, buying tickets and coming to our events.",
  path: "/legal/terms",
});

export default function TermsPage() {
  return <LegalPage doc={termsDoc} />;
}
