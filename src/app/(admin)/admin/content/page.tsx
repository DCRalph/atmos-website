import { AdminSection } from "~/components/admin/admin-section";
import { ContentManager } from "~/components/admin/content-manager";

export default function AdminContentPage() {
  return (
    <AdminSection
      title="Content"
      description="Manage posts, videos, and other content"
    >
      <ContentManager />
    </AdminSection>
  );
}
