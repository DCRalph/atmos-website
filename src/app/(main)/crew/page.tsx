"use client";

import CrewPage from "./Crew";
import { BreadcrumbJsonLd } from "~/components/seo/json-ld";
import { usePageMetadata } from "~/hooks/use-page-metadata";
import { SITE_URL } from "~/lib/seo-constants";

export default function Page() {
  usePageMetadata({
    title: "Crew",
    description:
      "Meet the ATMOS crew: the DJs, producers and creatives behind Atmos.",
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
