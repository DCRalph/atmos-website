import { AdminSection } from "~/components/admin/admin-section";
import { CreatorProfilesManager } from "~/components/admin/creator-profiles-manager";

export default function CreatorProfilesAdminPage() {
  return (
    <AdminSection
      title="Creator profiles"
      description="Public profile pages for DJs, creators and producers, whether or not a user has claimed them yet."
    >
      <CreatorProfilesManager />
    </AdminSection>
  );
}
