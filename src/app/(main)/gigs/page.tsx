import GigsPage from "./Gigs";
import { BreadcrumbJsonLd } from "~/components/seo/json-ld";
import { pageMetadata } from "~/lib/seo-constants";

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

export default function Page() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Gigs", url: "/gigs" },
        ]}
      />
      <GigsPage />
    </>
  );
}
