import { AdminSection } from "~/components/admin/admin-section";
import { NewsletterManager } from "~/components/admin/newsletter-manager";

export default function AdminNewsletterPage() {
  return (
    <AdminSection title="Newsletter" description="Manage newsletter signups">
      <NewsletterManager />
    </AdminSection>
  );
}


