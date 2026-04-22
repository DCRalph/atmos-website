import { AdminSection } from "~/components/admin/admin-section";
import { ClaimRequestsManager } from "~/components/admin/claim-requests-manager";

export default function CreatorProfileClaimsPage() {
  return (
    <AdminSection
      title="Profile claim requests"
      description="Review and approve users who have asked to claim an unclaimed creator profile. Approving links the profile to the user and grants them edit access."
      backLink={{
        href: "/admin/creator-profiles",
        label: "← Back to profiles",
      }}
    >
      <ClaimRequestsManager />
    </AdminSection>
  );
}
