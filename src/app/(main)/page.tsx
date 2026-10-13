import { HomePage } from "~/components/site/home/home-page";
import { OrganizationJsonLd, WebSiteJsonLd } from "~/components/seo/json-ld";
import {
  COMMON_KEYWORDS,
  DESCRIPTION_LONG,
  pageMetadata,
} from "~/lib/seo-constants";
import { api, HydrateClient } from "~/trpc/server";

export const metadata = pageMetadata({
  title: { absolute: "ATMOS · Immersive electronic music events" },
  description: DESCRIPTION_LONG,
  path: "/",
  keywords: COMMON_KEYWORDS,
});

export default async function Home() {
  await Promise.all([
    api.gigs.getUpcoming.prefetch(),
    api.gigs.getToday.prefetch(),
    api.homeGigs.getHomeRecent.prefetch(),
    api.homeContent.getHomeLatest.prefetch(),
  ]);

  return (
    <>
      {/* JSON-LD Structured Data for Google Rich Results */}
      <OrganizationJsonLd />
      <WebSiteJsonLd />

      <HydrateClient>
        <HomePage />
      </HydrateClient>
    </>
  );
}
