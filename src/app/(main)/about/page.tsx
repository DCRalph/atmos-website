import AboutPage from "./About";
import { type Metadata } from "next";
import { BreadcrumbJsonLd } from "~/components/seo/json-ld";
import { createPageMetadata } from "~/lib/seo-constants";

export const metadata: Metadata = createPageMetadata("about", {
  alternates: {
    canonical: "/about",
  },
});

export default function page() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "About", url: "/about" },
        ]}
      />
      <AboutPage />
    </>
  );
}
