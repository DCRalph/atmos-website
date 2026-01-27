import GigsPage from "./Gigs";
import { type Metadata } from "next";
import { BreadcrumbJsonLd } from "~/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Wellington DJ Events & Club Nights",
  description:
    "Discover upcoming electronic music events in Wellington. Browse our curated lineup of club nights, DJ sets, techno & house music events in Pōneke. Get tickets now.",
  keywords: [
    "wellington dj events",
    "wellington club nights",
    "wellington nightlife events",
    "techno night wellington",
    "house music night wellington",
    "things to do in wellington at night",
    "wellington gig guide electronic",
    "pōneke nightlife events",
  ],
  openGraph: {
    title: "Wellington DJ Events & Club Nights | ATMOS",
    description:
      "Discover upcoming electronic music events in Wellington. Browse our curated lineup of club nights, DJ sets, and immersive nightlife experiences.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wellington DJ Events & Club Nights | ATMOS",
    description:
      "Discover upcoming electronic music events in Wellington. Curated club nights & DJ sets in Pōneke.",
  },
  alternates: {
    canonical: "/gigs",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

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
