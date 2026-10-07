import { AdminSection } from "~/components/admin/admin-section";
import { AdminArtistThemesList } from "./list";

export default function AdminArtistThemesPage() {
  return (
    <AdminSection
      title="Artist themes"
      description="Manage every theme that artists can apply to their profile page: starters, public themes, and private user-owned themes."
    >
      <AdminArtistThemesList />
    </AdminSection>
  );
}
