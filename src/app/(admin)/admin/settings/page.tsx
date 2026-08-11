import { AdminSection } from "~/components/admin/admin-section";
import { SettingsManager } from "~/components/admin/settings-manager";
import { TicketingSettings } from "~/components/admin/ticketing/ticketing-settings";

export default function AdminSettingsPage() {
  return (
    <AdminSection
      title="System Settings"
      description="Manage application configuration and key-value store"
    >
      <div className="space-y-10">
        <TicketingSettings />
        <SettingsManager />
      </div>
    </AdminSection>
  );
}
