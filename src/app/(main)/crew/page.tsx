import CrewPage from "./Crew";
import { BreadcrumbJsonLd } from "~/components/seo/json-ld";
import { pageMetadata } from "~/lib/seo-constants";
import { api, HydrateClient } from "~/trpc/server";

export const metadata = pageMetadata({
  title: "Crew",
  description:
    "Meet the ATMOS crew: the DJs, producers and creatives behind Atmos.",
  path: "/crew",
});

export default async function Page() {
  await api.crew.getAll.prefetch();

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Crew", url: "/crew" },
        ]}
      />
      <HydrateClient>
        <CrewPage />
      </HydrateClient>
    </>
  );
}
