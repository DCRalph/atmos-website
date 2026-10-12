import TicketsPage from "./tickets-client";
import { unlistedPageMetadata } from "~/lib/seo-constants";

export const metadata = unlistedPageMetadata(
  "Your tickets",
  "Your tickets to an Atmos event.",
);

export default function Page() {
  return <TicketsPage />;
}
