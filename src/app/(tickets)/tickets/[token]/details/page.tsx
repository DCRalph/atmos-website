import TicketDetailsPage from "./details-client";
import { unlistedPageMetadata } from "~/lib/seo-constants";

export const metadata = unlistedPageMetadata(
  "Your details",
  "Add your details to your Atmos order.",
);

export default function Page() {
  return <TicketDetailsPage />;
}
