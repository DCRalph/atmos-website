"use client";

import { LegalPage } from "~/components/site/legal/legal-page";
import { termsDoc } from "~/components/site/legal/legal-docs";
import { usePageMetadata } from "~/hooks/use-page-metadata";
import { SITE_URL } from "~/lib/seo-constants";

export default function TermsPage() {
  usePageMetadata({
    title: "Terms",
    canonical: `${SITE_URL}/terms`,
  });

  return <LegalPage doc={termsDoc} />;
}
