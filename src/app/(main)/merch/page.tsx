import MerchPage from "./Merch";
import { type Metadata } from "next";
import { createPageMetadata } from "~/lib/seo-constants";

export const metadata: Metadata = createPageMetadata("merch", {
  alternates: {
    canonical: "/merch",
  },
});

export default function page() {
  return <MerchPage />;
}
