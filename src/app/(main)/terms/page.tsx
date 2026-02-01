import TermsPage from "./Terms";
import { type Metadata } from "next";
import { createPageMetadata } from "~/lib/seo-constants";

export const metadata: Metadata = createPageMetadata("terms", {
  alternates: {
    canonical: "/terms",
  },
});

export default function page() {
  return <TermsPage />;
}
