"use client";

import ContentPage from "./Content";
import { usePageMetadata } from "~/hooks/use-page-metadata";
import { SITE_URL } from "~/lib/seo-constants";

export default function page() {
  usePageMetadata({
    title: "Content",
    canonical: `${SITE_URL}/content`,
  });

  return <ContentPage />;
}
