"use client";

import AboutPage from "./About";
import { BreadcrumbJsonLd } from "~/components/seo/json-ld";
import { usePageMetadata } from "~/hooks/use-page-metadata";
import { SITE_URL } from "~/lib/seo-constants";

export default function page() {
  usePageMetadata({
    title: "About",
    description:
      "ATMOS is an electronic music promoter and collective. We curate underground club nights and immersive DJ events.",
    canonical: `${SITE_URL}/about`,
  });

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "About", url: "/about" },
        ]}
      />
      <AboutPage />
    </>
  );
}
