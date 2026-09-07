import { AdminSection } from "~/components/admin/admin-section";
import { ContactManager } from "~/components/admin/contact-manager";

export default function AdminContactPage() {
  return (
    <AdminSection
      title="Contact"
      description="Messages sent through the contact form on the site."
    >
      <ContactManager />
    </AdminSection>
  );
}
