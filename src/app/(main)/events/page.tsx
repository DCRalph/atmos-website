import EventsClient from "./events-client";
import { BreadcrumbJsonLd } from "~/components/seo/json-ld";
import { pageMetadata } from "~/lib/seo-constants";

export const metadata = pageMetadata({
  title: "Tickets",
  description: "Buy tickets to upcoming Atmos events.",
  path: "/events",
});

export default function EventsPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Tickets", url: "/events" },
        ]}
      />
      <EventsClient />
    </>
  );
}
