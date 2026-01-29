import { Suspense } from "react";
import { type Metadata } from "next";
import { headers } from "next/headers";
import { HomePageClient } from "~/components/home/home-page-client";
import {
  OrganizationJsonLd,
  WebSiteJsonLd,
} from "~/components/seo/json-ld";
import { isSearchEngineBot } from "~/lib/bot-detection";

// SEO-optimized metadata for the homepage
export const metadata: Metadata = {
  title: "Wellington Electronic Music Events",
  description:
    "Discover Wellington's best electronic music events. Curated club nights, underground DJ sets & immersive nightlife in Pōneke. Browse events & get tickets.",
  keywords: [
    "wellington electronic music events",
    "wellington club nights",
    "wellington dj events",
    "pōneke nightlife",
    "underground club night wellington",
    "techno night wellington",
    "house music night wellington",
    "wellington nightlife events",
    "nz electronic music events",
    "dance music collective wellington",
    "electronic music promoter wellington",
  ],
  openGraph: {
    title: "Wellington Electronic Music Events | ATMOS",
    description:
      "Wellington's home for curated electronic music events. From underground techno to house, experience immersive club nights featuring local and international DJs. Browse upcoming events, explore our artist roster, and relive past nights through our photo archive.",
    type: "website",
    locale: "en_NZ",
    siteName: "ATMOS",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wellington Electronic Music Events | ATMOS",
    description:
      "Discover Wellington's best electronic music events. Curated club nights, underground DJ sets & immersive nightlife in Pōneke.",
  },
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

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
