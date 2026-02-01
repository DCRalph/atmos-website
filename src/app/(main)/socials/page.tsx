import SocialsPage from "./Socials";
import { type Metadata } from "next";
import { createPageMetadata } from "~/lib/seo-constants";

export const metadata: Metadata = createPageMetadata("socials", {
  alternates: {
    canonical: "/socials",
  },
});

export default function page() {
  return <SocialsPage />;
}
