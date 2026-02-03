"use client";

import MerchPage from "./Merch";
import { usePageMetadata } from "~/hooks/use-page-metadata";
import { SITE_URL } from "~/lib/seo-constants";

export default function page() {
  usePageMetadata({
    title: "Merch",
    canonical: `${SITE_URL}/merch`,
  });

  return <MerchPage />;
}
