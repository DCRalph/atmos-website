"use client";

import { HomePage } from "~/components/site/home/home-page";
import { OrganizationJsonLd, WebSiteJsonLd } from "~/components/seo/json-ld";
import { usePageMetadata } from "~/hooks/use-page-metadata";
import { SITE_URL } from "~/lib/seo-constants";

export default function Home() {
  // Set up page metadata
  usePageMetadata({
    title: "ATMOS · Immersive electronic music events in Pōneke",
    description:
      "Discover Wellington's best electronic music events. Curated club nights, underground DJ sets & immersive nightlife in Pōneke.",
    canonical: `${SITE_URL}/`,
  });

  return (
    <>
      {/* JSON-LD Structured Data for Google Rich Results */}
      <OrganizationJsonLd />
      <WebSiteJsonLd />

      <HomePage />
    </>
  );
}
