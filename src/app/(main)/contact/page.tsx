"use client";

import ContactPage from "./Contact";
import { usePageMetadata } from "~/hooks/use-page-metadata";
import { SITE_URL } from "~/lib/seo-constants";

export default function page() {
  usePageMetadata({
    title: "Contact",
    canonical: `${SITE_URL}/contact`,
  });

  return <ContactPage />;
}
