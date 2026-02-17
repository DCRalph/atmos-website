import { AdminSection } from "~/components/admin/admin-section";
import { GearRentalManager } from "~/components/admin/gear-rental-manager";

export default function AdminRentalsPage() {
  return (
    <AdminSection title="Gear Rentals" description="Manage gear inventory and rental requests">
      <GearRentalManager />
    </AdminSection>
  );
}
