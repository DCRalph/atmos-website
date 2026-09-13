import { AdminSection } from "~/components/admin/admin-section";
import { LifetimeTicketsPanel } from "~/components/admin/ticketing/lifetime-tickets-panel";

export default function AdminLifetimeTicketsPage() {
  return (
    <AdminSection
      title="Lifetime tickets"
      description="One named person, every Atmos event. Issue a pass, send it, and see every door it has been through."
    >
      <LifetimeTicketsPanel />
    </AdminSection>
  );
}
