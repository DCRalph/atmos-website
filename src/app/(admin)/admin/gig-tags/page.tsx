import { AdminSection } from "~/components/admin/admin-section";
import { GigTagsManager } from "~/components/admin/gig-tags-manager";

export default function AdminGigTagsPage() {
  return (
    <AdminSection
      title="Gig tags"
      description="Reusable tags for grouping gigs, and the colour each one carries."
    >
      <GigTagsManager />
    </AdminSection>
  );
}
