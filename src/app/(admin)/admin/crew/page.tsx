import { AdminSection } from "~/components/admin/admin-section";
import { CrewManager } from "~/components/admin/crew-manager";

export default function AdminCrewPage() {
  return (
    <AdminSection title="Crew" description="Manage crew members">
      <CrewManager />
    </AdminSection>
  );
}


