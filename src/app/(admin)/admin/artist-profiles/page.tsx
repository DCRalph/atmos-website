import { AdminSection } from "~/components/admin/admin-section";
import { ArtistProfilesManager } from "~/components/admin/artist-profiles-manager";

export default function ArtistProfilesAdminPage() {
  return (
    <AdminSection
      title="Artist profiles"
      description="Public profile pages for DJs, artists and producers, whether or not a user has claimed them yet."
    >
      <ArtistProfilesManager />
    </AdminSection>
  );
}
