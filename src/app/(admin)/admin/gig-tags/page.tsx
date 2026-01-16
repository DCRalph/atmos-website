import { AdminSection } from "~/components/admin/admin-section";
import { GigTagsManager } from "~/components/admin/gig-tags-manager";

export default function AdminGigTagsPage() {
  return (
    <AdminSection title="Gig Tags" description="Create and manage gig tags">
      <GigTagsManager />
    </AdminSection>
  );
}
