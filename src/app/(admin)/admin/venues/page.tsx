import { AdminSection } from "~/components/admin/admin-section";
import { VenuesManager } from "~/components/admin/venues/venues-manager";

export default function AdminVenuesPage() {
  return (
    <AdminSection
      title="Venues"
      description="Where gigs and events are on, with the logo shown on their pages."
    >
      <VenuesManager />
    </AdminSection>
  );
}
