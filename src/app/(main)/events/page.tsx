import EventsClient from "./events-client";
import { BreadcrumbJsonLd } from "~/components/seo/json-ld";
import { pageMetadata } from "~/lib/seo-constants";
import { api, HydrateClient } from "~/trpc/server";

export const metadata = pageMetadata({
  title: "Tickets",
  description: "Buy tickets to upcoming Atmos events.",
  path: "/events",
});

export default async function EventsPage() {
  await api.ticketEvents.upcoming.prefetch();

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Tickets", url: "/events" },
        ]}
      />
      <HydrateClient>
        <EventsClient />
      </HydrateClient>
    </>
  );
}
