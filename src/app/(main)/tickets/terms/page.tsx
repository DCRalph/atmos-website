import type { Metadata } from "next";

import TicketTermsPage from "./TicketTerms";

export const metadata: Metadata = {
  title: "Ticket terms",
  description:
    "Terms of sale for tickets bought through Atmos Media, including refunds, entry conditions and privacy.",
  robots: { index: true, follow: true },
};

/**
 * Terms of ticket sale, version v1.
 *
 * `TicketOrder.termsVersion` records which version a buyer agreed to. If these
 * change materially, bump the version on the event rather than editing this
 * page in place, so historical orders still point at what was actually agreed.
 */
export default function page() {
  return <TicketTermsPage />;
}
