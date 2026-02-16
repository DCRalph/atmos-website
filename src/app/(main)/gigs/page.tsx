"use client";

import GigsPage from "./Gigs";
import { BreadcrumbJsonLd } from "~/components/seo/json-ld";
import { usePageMetadata } from "~/hooks/use-page-metadata";
import { SITE_URL } from "~/lib/seo-constants";

export default function page() {
  usePageMetadata({
    title: "Events",
    description: "Immersive curated electronic music events in Pōneke",
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
