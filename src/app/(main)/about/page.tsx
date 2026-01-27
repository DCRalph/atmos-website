import AboutPage from "./About";
import { type Metadata } from "next";
import { BreadcrumbJsonLd } from "~/components/seo/json-ld";

export const metadata: Metadata = {
  title: "About ATMOS — Wellington Electronic Music Collective",
  description:
    "ATMOS is Wellington's electronic music promoter & collective. We curate underground club nights, immersive DJ events, and nightlife experiences in Pōneke, New Zealand.",
  keywords: [
    "electronic music promoter wellington",
    "dance music collective wellington",
    "pōneke electronic music",
    "wellington nightlife",
    "underground club night wellington",
    "nz electronic music collective",
  ],
  openGraph: {
    title: "About ATMOS — Wellington Electronic Music Collective",
    description:
      "ATMOS is Wellington's electronic music promoter & collective. We curate underground club nights and immersive DJ events in Pōneke.",
    type: "website",
  },
  alternates: {
    canonical: "/about",
  },
};

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
