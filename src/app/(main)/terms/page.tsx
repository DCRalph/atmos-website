"use client";

import TermsPage from "./Terms";
import { usePageMetadata } from "~/hooks/use-page-metadata";
import { SITE_URL } from "~/lib/seo-constants";

export default function page() {
  usePageMetadata({
    title: "Terms",
    canonical: `${SITE_URL}/terms`,
  });

  return <TermsPage />;
}
