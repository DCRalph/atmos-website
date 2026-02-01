import ContentPage from "./Content";
import { type Metadata } from "next";
import { createPageMetadata } from "~/lib/seo-constants";

export const metadata: Metadata = createPageMetadata("content", {
  alternates: {
    canonical: "/content",
  },
});

export default function page() {
  return <ContentPage />;
}
