"use client";

import GigsPage from "./Gigs";
import { BreadcrumbJsonLd } from "~/components/seo/json-ld";
import { usePageMetadata } from "~/hooks/use-page-metadata";
import { SITE_URL } from "~/lib/seo-constants";

export default function page() {
  usePageMetadata({
    title: "Events",
    description: "Discover upcoming electronic music events in Wellington. Browse curated club nights, DJ sets, and immersive nightlife experiences.",
    canonical: `${SITE_URL}/gigs`,
  });

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Events", url: "/gigs" },
        ]}
      />
      <GigsPage />
    </>
  );
}
