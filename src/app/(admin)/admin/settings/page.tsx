import { AdminSection } from "~/components/admin/admin-section";
import { SettingsManager } from "~/components/admin/settings-manager";

export default function AdminSettingsPage() {
  return (
    <AdminSection
      title="System Settings"
      description="Manage application configuration and key-value store"
    >
      <SettingsManager />
    </AdminSection>
  );
}
