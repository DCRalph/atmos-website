import MerchPage from "./Merch";
import { pageMetadata } from "~/lib/seo-constants";

export const metadata = pageMetadata({
  title: "Merch",
  description: "Limited drops and Atmos staples.",
  path: "/merch",
});

export default function Page() {
  return <MerchPage />;
}
