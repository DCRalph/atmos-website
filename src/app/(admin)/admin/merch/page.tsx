import { AdminSection } from "~/components/admin/admin-section";
import { ShopifyIntegrationManager } from "~/components/admin/shopify-integration-manager";

export default function AdminMerchPage() {
  return (
    <AdminSection
      title="Merch"
      description="Sync products from Shopify and set the order they appear on the merch page"
    >
      <ShopifyIntegrationManager />
    </AdminSection>
  );
}
