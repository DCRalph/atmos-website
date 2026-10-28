import { AdminSection } from "~/components/admin/admin-section";
import { NotificationHistory } from "~/components/admin/notification-history";

export default function AdminNotificationHistoryPage() {
  return (
    <AdminSection
      title="Notification history"
      description="Every notification the site has sent. Open one for the full record."
      backLink={{ href: "/admin/notifications", label: "Notifications" }}
    >
      <NotificationHistory />
    </AdminSection>
  );
}
