import { AdminSection } from "~/components/admin/admin-section";
import { ClaimRequestsManager } from "~/components/admin/claim-requests-manager";

export default function ArtistProfileClaimsPage() {
  return (
    <AdminSection
      title="Artist claims"
      description="Users asking to claim an unclaimed profile. Approving links the profile to them and grants edit access."
      backLink={{ href: "/admin/artist-profiles", label: "Artist profiles" }}
    >
      <ClaimRequestsManager />
    </AdminSection>
  );
}
