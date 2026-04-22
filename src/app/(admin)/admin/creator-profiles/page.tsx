import { AdminSection } from "~/components/admin/admin-section";
import { CreatorProfilesManager } from "~/components/admin/creator-profiles-manager";

export default function CreatorProfilesAdminPage() {
  return (
    <AdminSection
      title="Creator Profiles"
      description="Manage DJ / creator / producer profile pages, create new profiles (linked to a user or unclaimed), and moderate claim requests."
    >
      <CreatorProfilesManager />
    </AdminSection>
  );
}
