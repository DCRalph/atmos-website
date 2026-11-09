import RefundPage from "./refund-client";
import { unlistedPageMetadata } from "~/lib/seo-constants";

export const metadata = unlistedPageMetadata(
  "Your refund",
  "A refund Atmos has offered on your tickets.",
);

export default function Page() {
  return <RefundPage />;
}
