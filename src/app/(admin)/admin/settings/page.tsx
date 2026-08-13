import { AdminSection } from "~/components/admin/admin-section";
import { SettingsManager } from "~/components/admin/settings-manager";
import { TapToPayLaunchPanel } from "~/components/admin/ticketing/tap-to-pay-launch-panel";
import { TicketingSettings } from "~/components/admin/ticketing/ticketing-settings";

export default function AdminSettingsPage() {
  return (
    <AdminSection
      title="System Settings"
      description="Manage application configuration and key-value store"
    >
      <div className="space-y-10">
        {/* <TicketingSettings /> */}
        <TapToPayLaunchPanel />
        <SettingsManager />
      </div>
    </AdminSection>
  );
}
