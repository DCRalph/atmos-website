import PrivacyPage from "./Privacy";
import { type Metadata } from "next";
import { createPageMetadata } from "~/lib/seo-constants";

export const metadata: Metadata = createPageMetadata("privacy", {
  alternates: {
    canonical: "/privacy",
  },
});

export default function page() {
  return <PrivacyPage />;
}
