import { connection } from "next/server";
import GigsPage from "./Gigs";
import { BreadcrumbJsonLd } from "~/components/seo/json-ld";
import { pageMetadata } from "~/lib/seo-constants";
import { api, HydrateClient } from "~/trpc/server";

export const metadata = pageMetadata({
  title: "Gigs",
  description: "Upcoming events and past nights from Atmos.",
  path: "/gigs",
  keywords: [
    "dj events",
    "club nights",
    "techno nights",
    "house music nights",
    "electronic gig guide",
  ],
});

export default async function Page() {
  // Rendered per request already (the prefetches read headers). Said up front
  // so the build doesn't attempt a prerender, which fails on the tab's
  // useSearchParams with no Suspense boundary.
  await connection();
  await Promise.all([
    api.gigs.getUpcoming.prefetch(),
    api.gigs.getPast.prefetch({ kind: "OURS" }),
    api.gigs.getPast.prefetch({ kind: "AFFILIATED" }),
    api.ticketEvents.upcoming.prefetch(),
  ]);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Gigs", url: "/gigs" },
        ]}
      />
      <HydrateClient>
        <GigsPage />
      </HydrateClient>
    </>
  );
}
