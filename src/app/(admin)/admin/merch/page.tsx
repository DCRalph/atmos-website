import { AdminSection } from "~/components/admin/admin-section";
import { MerchManager } from "~/components/admin/merch-manager";

export default function AdminMerchPage() {
  return (
    <AdminSection title="Merch" description="Manage merchandise listings">
      <MerchManager />
    </AdminSection>
  );
}
