import { HomePage } from "~/components/site/home/home-page";
import { OrganizationJsonLd, WebSiteJsonLd } from "~/components/seo/json-ld";
import { COMMON_KEYWORDS, pageMetadata } from "~/lib/seo-constants";

export const metadata = pageMetadata({
  title: { absolute: "ATMOS · Immersive electronic music events" },
  description:
    "Curated club nights, underground DJ sets and immersive electronic music events from Atmos.",
  path: "/",
  keywords: COMMON_KEYWORDS,
});

export default function Home() {
  return (
    <>
      {/* JSON-LD Structured Data for Google Rich Results */}
      <OrganizationJsonLd />
      <WebSiteJsonLd />

      <HomePage />
    </>
  );
}
