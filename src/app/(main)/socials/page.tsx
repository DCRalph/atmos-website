"use client";

import SocialsPage from "./Socials";
import { usePageMetadata } from "~/hooks/use-page-metadata";
import { SITE_URL } from "~/lib/seo-constants";

export default function page() {
  usePageMetadata({
    title: "Socials",
    canonical: `${SITE_URL}/socials`,
  });

  return <SocialsPage />;
}
