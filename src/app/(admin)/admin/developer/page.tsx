import { AdminSection } from "~/components/admin/admin-section";
import { DeveloperManager } from "~/components/admin/developer/developer-manager";

export default function AdminDeveloperPage() {
  return (
    <AdminSection
      title="Developer"
      description="API keys for other systems, and the reference for the notifications API."
    >
      <DeveloperManager />
    </AdminSection>
  );
}
