import { AdminSection } from "~/components/admin/admin-section";
import { NotificationsManager } from "~/components/admin/notifications-manager";

export default function AdminNotificationsPage() {
  return (
    <AdminSection
      title="Notifications"
      description="Push to registered handsets. The same path as the /api/notify endpoint."
    >
      <NotificationsManager />
    </AdminSection>
  );
}
