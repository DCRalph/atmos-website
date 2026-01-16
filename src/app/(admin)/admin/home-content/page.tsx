import { AdminSection } from "~/components/admin/admin-section";
import { HomeContentManager } from "~/components/admin/home-content-manager";

export default function AdminHomeContentPage() {
  return (
    <AdminSection
      title="Home Content"
      description="Reorder which content appears in the Home “Latest Content” section."
    >
      <HomeContentManager />
    </AdminSection>
  );
}

