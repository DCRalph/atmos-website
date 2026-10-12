import TicketPage from "./ticket-client";
import { unlistedPageMetadata } from "~/lib/seo-constants";

export const metadata = unlistedPageMetadata(
  "Your ticket",
  "Your ticket to an Atmos event.",
);

export default function Page() {
  return <TicketPage />;
}
