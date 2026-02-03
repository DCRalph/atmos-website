"use client";

import CrewPage from "./Crew";
import { BreadcrumbJsonLd } from "~/components/seo/json-ld";
import { usePageMetadata } from "~/hooks/use-page-metadata";
import { SITE_URL } from "~/lib/seo-constants";

export default function page() {
  usePageMetadata({
    title: "Crew",
    description: "Meet the ATMOS crew — Wellington's finest DJs, producers, and electronic music artists from the Pōneke underground scene.",
    canonical: `${SITE_URL}/crew`,
  });

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Crew", url: "/crew" },
        ]}
      />
      <CrewPage />
    </>
  );
}
