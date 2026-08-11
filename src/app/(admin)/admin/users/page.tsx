import { AdminSection } from "~/components/admin/admin-section";
import { UsersManager } from "~/components/admin/users-manager";

export default function AdminUsersPage() {
  return (
    <AdminSection title="Users" description="Manage user permissions">
      <UsersManager />
    </AdminSection>
  );
}
