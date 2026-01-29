import { AdminSection } from "~/components/admin/admin-section";
import { ActivityLogsManager } from "~/components/admin/activity-logs-manager";

export default function ActivityLogsPage() {
  return (
    <AdminSection title="Activity Logs" description="View all system activities and user actions">
      <ActivityLogsManager />
    </AdminSection>
  );
}
