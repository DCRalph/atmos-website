import { AdminSection } from "~/components/admin/admin-section";
import { HomeGigsManager } from "~/components/admin/home-gigs-manager";

export default function AdminHomeGigsPage() {
  return (
    <AdminSection
      title="Home Gig Placements"
      description="Reorder which past gigs appear in the Home “Recent Gigs” section."
    >
      <HomeGigsManager />
    </AdminSection>
  );
}
