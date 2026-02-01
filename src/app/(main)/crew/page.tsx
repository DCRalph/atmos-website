import CrewPage from "./Crew";
import { type Metadata } from "next";
import { BreadcrumbJsonLd } from "~/components/seo/json-ld";
import { createPageMetadata } from "~/lib/seo-constants";

export const metadata: Metadata = createPageMetadata("crew", {
  alternates: {
    canonical: "/crew",
  },
});

export default function page() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Crew", url: "/crew" },
        ]}
      />
      <CrewPage />
    </>
  );
}
