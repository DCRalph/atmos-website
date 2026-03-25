import { AdminSection } from "~/components/admin/admin-section";
import { ShopifyIntegrationManager } from "~/components/admin/shopify-integration-manager";

export default function AdminShopifyPage() {
  return (
    <AdminSection
      title="Shopify"
      description="Sync products from your Shopify store into the site cache"
    >
      <ShopifyIntegrationManager />
    </AdminSection>
  );
}
