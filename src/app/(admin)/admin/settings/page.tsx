import { AdminSection } from "~/components/admin/admin-section";
import { ContractSettings } from "~/components/admin/contracts/contract-settings";
import { SettingsManager } from "~/components/admin/settings-manager";
import { TapToPayLaunchPanel } from "~/components/admin/ticketing/tap-to-pay-launch-panel";

export default function AdminSettingsPage() {
  return (
    <AdminSection
      title="Settings"
      description="Application configuration and the key-value store behind it."
    >
      <div className="space-y-10">
        <TapToPayLaunchPanel />
        <ContractSettings />
        <SettingsManager />
      </div>
    </AdminSection>
  );
}
