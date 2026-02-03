"use client";

import { useEffect, useState } from "react";
import { HomePageClient } from "~/components/home/home-page-client";
import {
  OrganizationJsonLd,
  WebSiteJsonLd,
} from "~/components/seo/json-ld";
import { isSearchEngineBot } from "~/lib/bot-detection";
import { usePageMetadata } from "~/hooks/use-page-metadata";
import { SITE_URL } from "~/lib/seo-constants";

export default function Home() {
  const [isBot, setIsBot] = useState(false);

  // Set up page metadata
  usePageMetadata({
    title: "ATMOS — Immersive electronic music events in Pōneke",
    description: "Discover Wellington's best electronic music events. Curated club nights, underground DJ sets & immersive nightlife in Pōneke.",
    canonical: `${SITE_URL}/`,
  });

  // Detect if the request is from a search engine bot (client-side)
  useEffect(() => {
    const userAgent = navigator.userAgent;
    setIsBot(isSearchEngineBot(userAgent));
  }, []);

  return (
    <>
      {/* JSON-LD Structured Data for Google Rich Results */}
      <OrganizationJsonLd />
      <WebSiteJsonLd />

      <HomePageClient isBot={isBot} />
    </>
  );
}
