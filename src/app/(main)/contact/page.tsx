import ContactPage from "./Contact";
import { type Metadata } from "next";
import { createPageMetadata } from "~/lib/seo-constants";

export const metadata: Metadata = createPageMetadata("contact", {
  alternates: {
    canonical: "/contact",
  },
});

export default function page() {
  return <ContactPage />;
}
