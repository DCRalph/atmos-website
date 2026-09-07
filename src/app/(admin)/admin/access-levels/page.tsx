import { AdminSection } from "~/components/admin/admin-section";
import { AccessLevelsPanel } from "~/components/admin/ticketing/access-levels-panel";

export default function AdminAccessLevelsPage() {
  return (
    <AdminSection
      title="Access levels"
      description="What a ticket gets you past, on door badges and as the colour a wallet pass tints itself with."
    >
      <AccessLevelsPanel />
    </AdminSection>
  );
}
