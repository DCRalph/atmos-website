import { AdminSection } from "~/components/admin/admin-section";
import { GearRentalManager } from "~/components/admin/gear-rental-manager";

export default function AdminRentalsPage() {
  return (
    <AdminSection
      title="Rental Packages"
      description="Manage inventory items, rentable packages, and package booking requests"
    >
      <GearRentalManager />
    </AdminSection>
  );
}
