import { LegalPage } from "~/components/site/legal/legal-page";
import { ticketTermsDoc } from "~/components/site/legal/legal-docs";
import { pageMetadata } from "~/lib/seo-constants";

export const metadata = pageMetadata({
  title: "Ticket terms",
  description:
    "Terms of sale for tickets bought through Atmos Media, including refunds, entry conditions and privacy.",
  path: "/legal/ticket-terms",
});

/**
 * Terms of ticket sale. The text lives in `ticketTermsDoc`; see there before
 * changing anything a buyer has already agreed to.
 */
export default function TicketTermsPage() {
  return <LegalPage doc={ticketTermsDoc} />;
}
