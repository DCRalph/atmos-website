import CrewPage from "./Crew";
import { type Metadata } from "next";
import { BreadcrumbJsonLd } from "~/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Wellington DJs & Artists",
  description:
    "Meet the ATMOS crew — Wellington's finest DJs, producers, and electronic music artists. Discover local talent from the Pōneke underground scene.",
  keywords: [
    "wellington djs",
    "wellington techno dj",
    "wellington house dj",
    "pōneke dj collective",
    "nz electronic producers",
    "new zealand djs",
    "wellington electronic artists",
  ],
  openGraph: {
    title: "Wellington DJs & Artists | ATMOS",
    description:
      "Meet the ATMOS crew — Wellington's finest DJs, producers, and electronic music artists from the Pōneke underground scene.",
    type: "website",
  },
  alternates: {
    canonical: "/crew",
  },
};

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
