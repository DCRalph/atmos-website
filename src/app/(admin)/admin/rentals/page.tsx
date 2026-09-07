import { AdminSection } from "~/components/admin/admin-section";
import { GearRentalManager } from "~/components/admin/gear-rental-manager";

export default function AdminRentalsPage() {
  return (
    <AdminSection
      title="Rentals"
      description="Gear available to hire, the packages it is sold in, and the requests that come back."
    >
      <GearRentalManager />
    </AdminSection>
  );
}
