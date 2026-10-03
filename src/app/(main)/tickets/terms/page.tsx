import type { Metadata } from "next";

import { LegalPage } from "~/components/site/legal/legal-page";
import { ticketTermsDoc } from "~/components/site/legal/legal-docs";

export const metadata: Metadata = {
  title: "Ticket terms",
  description:
    "Terms of sale for tickets bought through Atmos Media, including refunds, entry conditions and privacy.",
  robots: { index: true, follow: true },
};

/**
 * Terms of ticket sale. The text and its version live in `ticketTermsDoc`;
 * see there before changing anything a buyer has already agreed to.
 */
export default function TicketTermsPage() {
  return <LegalPage doc={ticketTermsDoc} />;
}
