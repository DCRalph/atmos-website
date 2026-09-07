import { AdminSection } from "~/components/admin/admin-section";
import { UsersManager } from "~/components/admin/users-manager";

export default function AdminUsersPage() {
  return (
    <AdminSection
      title="Users"
      description="Accounts, how they sign in, and what they may do."
    >
      <UsersManager />
    </AdminSection>
  );
}
