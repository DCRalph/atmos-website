import { AdminSection } from "~/components/admin/admin-section";
import { NewsletterManager } from "~/components/admin/newsletter-manager";

export default function AdminNewsletterPage() {
  return (
    <AdminSection
      title="Newsletter"
      description="Everyone signed up, and whether they are still being sent to."
    >
      <NewsletterManager />
    </AdminSection>
  );
}
