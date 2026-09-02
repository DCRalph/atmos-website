import { AdminSection } from "~/components/admin/admin-section";
import { CrewManager } from "~/components/admin/crew-manager";

export default function AdminCrewPage() {
  return (
    <AdminSection
      title="Crew"
      description="The Atmos crew directory, in the order it appears on the site."
    >
      <CrewManager />
    </AdminSection>
  );
}
