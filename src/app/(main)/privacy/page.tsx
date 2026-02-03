"use client";

import PrivacyPage from "./Privacy";
import { usePageMetadata } from "~/hooks/use-page-metadata";
import { SITE_URL } from "~/lib/seo-constants";

export default function page() {
  usePageMetadata({
    title: "Privacy",
    canonical: `${SITE_URL}/privacy`,
  });

  return <PrivacyPage />;
}
