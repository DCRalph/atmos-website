import { AdminSection } from "~/components/admin/admin-section";
import { ShopifyIntegrationManager } from "~/components/admin/shopify-integration-manager";

export default function AdminMerchPage() {
  return (
    <AdminSection
      title="Merch"
      description="Products synced from Shopify, and the order they appear in on the merch page."
    >
      <ShopifyIntegrationManager />
    </AdminSection>
  );
}
