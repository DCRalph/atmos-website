import { AdminSection } from "~/components/admin/admin-section";
import { NotificationHistory } from "~/components/admin/notification-history";

export default async function AdminNotificationHistoryPage(
  props: PageProps<"/admin/notifications/history">,
) {
  // `?key=` opens it filtered to one API key, from the Developer page.
  const { key } = await props.searchParams;

  return (
    <AdminSection
      title="Notification history"
      description="Every notification the site has sent. Open one for the full record."
      backLink={{ href: "/admin/notifications", label: "Notifications" }}
    >
      <NotificationHistory
        initialApiKeyId={typeof key === "string" ? key : undefined}
      />
    </AdminSection>
  );
}
