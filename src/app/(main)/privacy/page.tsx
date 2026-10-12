import { LegalPage } from "~/components/site/legal/legal-page";
import { privacyDoc } from "~/components/site/legal/legal-docs";
import { pageMetadata } from "~/lib/seo-constants";

export const metadata = pageMetadata({
  title: "Privacy",
  description:
    "How Atmos collects, uses and protects your information, including when you buy a ticket.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return <LegalPage doc={privacyDoc} />;
}
