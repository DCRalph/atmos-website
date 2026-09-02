import { AdminSection } from "~/components/admin/admin-section";
import { ActivityLogsManager } from "~/components/admin/activity-logs-manager";

export default function ActivityLogsPage() {
  return (
    <AdminSection
      title="Activity logs"
      description="Every administrative action, who took it, and when."
    >
      <ActivityLogsManager />
    </AdminSection>
  );
}
