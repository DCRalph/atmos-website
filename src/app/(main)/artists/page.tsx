import { connection } from "next/server";
import { BreadcrumbJsonLd } from "~/components/seo/json-ld";
import { ArtistsPage } from "~/components/site/artists/artists-page";
import { pageMetadata } from "~/lib/seo-constants";
import { api, HydrateClient } from "~/trpc/server";

export const metadata = pageMetadata({
  title: "Artists",
  description: "Every artist who has played an Atmos night.",
  path: "/artists",
  keywords: ["dj lineup", "atmos artists", "electronic artists"],
});

export default async function Page() {
  // Per request, like the gigs page: the tab reads useSearchParams, which a
  // prerender can't do without a Suspense boundary.
  await connection();
  await api.artistProfiles.publicList.prefetch();

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Artists", url: "/artists" },
        ]}
      />
      <HydrateClient>
        <ArtistsPage />
      </HydrateClient>
    </>
  );
}
