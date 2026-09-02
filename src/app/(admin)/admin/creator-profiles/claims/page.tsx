import { AdminSection } from "~/components/admin/admin-section";
import { ClaimRequestsManager } from "~/components/admin/claim-requests-manager";

export default function CreatorProfileClaimsPage() {
  return (
    <AdminSection
      title="Creator claims"
      description="Users asking to claim an unclaimed profile. Approving links the profile to them and grants edit access."
      backLink={{ href: "/admin/creator-profiles", label: "Creator profiles" }}
    >
      <ClaimRequestsManager />
    </AdminSection>
  );
}
