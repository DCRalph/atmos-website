import { AdminSection } from "~/components/admin/admin-section";
import { GigsManager } from "~/components/admin/gigs-manager";

export default function AdminGigsPage() {
  return (
    <AdminSection title="Gigs" description="Manage upcoming and past gigs">
      <GigsManager />
    </AdminSection>
  );
}
