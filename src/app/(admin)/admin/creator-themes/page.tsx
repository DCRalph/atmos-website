import { AdminSection } from "~/components/admin/admin-section";
import { AdminCreatorThemesList } from "./list";

export default function AdminCreatorThemesPage() {
  return (
    <AdminSection
      title="Creator themes"
      description="Manage every theme that creators can apply to their profile page: starters, public themes, and private user-owned themes."
    >
      <AdminCreatorThemesList />
    </AdminSection>
  );
}
