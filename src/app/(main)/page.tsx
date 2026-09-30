"use client";

import { HomePage } from "~/components/site/home/home-page";
import { OrganizationJsonLd, WebSiteJsonLd } from "~/components/seo/json-ld";
import { usePageMetadata } from "~/hooks/use-page-metadata";
import { SITE_URL } from "~/lib/seo-constants";

export default function Home() {
  // Set up page metadata
  usePageMetadata({
    title: "ATMOS · Immersive electronic music events",
    description:
      "Curated club nights, underground DJ sets and immersive electronic music events from Atmos.",
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
