import MerchPage from "./Merch";
import { pageMetadata } from "~/lib/seo-constants";
import { api, HydrateClient } from "~/trpc/server";

export const metadata = pageMetadata({
  title: "Merch",
  description: "Limited drops and Atmos staples.",
  path: "/merch",
});

export default async function Page() {
  await api.shopify.getProducts.prefetch();

  return (
    <HydrateClient>
      <MerchPage />
    </HydrateClient>
  );
}
