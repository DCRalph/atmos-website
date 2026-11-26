import { AdminSection } from "~/components/admin/admin-section";
import { DeveloperManager } from "~/components/admin/developer/developer-manager";

export default function AdminDeveloperPage() {
  return (
    <AdminSection
      title="Developer"
      description="API keys for other systems, the API reference, and a playground to try it in."
    >
      <DeveloperManager />
    </AdminSection>
  );
}
