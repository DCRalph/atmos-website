import { Suspense } from "react";
import { type Metadata } from "next";
import { headers } from "next/headers";
import { HomePageClient } from "~/components/home/home-page-client";
import {
  OrganizationJsonLd,
  WebSiteJsonLd,
} from "~/components/seo/json-ld";
import { isSearchEngineBot } from "~/lib/bot-detection";
import { createPageMetadata } from "~/lib/seo-constants";

export const metadata: Metadata = createPageMetadata("home", {
  alternates: {
    canonical: "/",
  },
});

export default async function Home() {
  // Detect if the request is from a search engine bot
  const headersList = await headers();
  const userAgent = headersList.get("user-agent");
  const isBot = isSearchEngineBot(userAgent);

  return (
    <>
      {/* JSON-LD Structured Data for Google Rich Results */}
      <OrganizationJsonLd />
      <WebSiteJsonLd />

      <Suspense>
        <HomePageClient isBot={isBot} />
      </Suspense>
    </>
  );
}
