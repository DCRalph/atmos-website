import { LegalPage } from "~/components/site/legal/legal-page";
import { kaupapaDoc } from "~/components/site/legal/legal-docs";
import { pageMetadata } from "~/lib/seo-constants";

export const metadata = pageMetadata({
  title: "Kaupapa",
  description:
    "How we look after each other at Atmos gigs. Everyone on the floor is expected to follow it.",
  path: "/legal/kaupapa",
});

export default function KaupapaPage() {
  return <LegalPage doc={kaupapaDoc} />;
}
