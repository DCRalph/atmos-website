import GigsPage from "./Gigs";
import { type Metadata } from "next";
import { BreadcrumbJsonLd } from "~/components/seo/json-ld";
import { createPageMetadata } from "~/lib/seo-constants";

export const metadata: Metadata = createPageMetadata("gigs", {
  alternates: {
    canonical: "/gigs",
  },
});

export default function page() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Events", url: "/gigs" },
        ]}
      />
      <GigsPage />
    </>
  );
}
