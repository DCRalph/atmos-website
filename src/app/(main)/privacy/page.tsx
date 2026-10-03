"use client";

import { LegalPage } from "~/components/site/legal/legal-page";
import { privacyDoc } from "~/components/site/legal/legal-docs";
import { usePageMetadata } from "~/hooks/use-page-metadata";
import { SITE_URL } from "~/lib/seo-constants";

export default function PrivacyPage() {
  usePageMetadata({
    title: "Privacy",
    canonical: `${SITE_URL}/privacy`,
  });

  return <LegalPage doc={privacyDoc} />;
}
