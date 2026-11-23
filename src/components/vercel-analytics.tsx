"use client";

import { Analytics } from "@vercel/analytics/next";

import { redactInvoiceToken } from "~/lib/hire-invoices";
import { redactShareToken } from "~/lib/ticketing/share-link";

/**
 * Vercel Analytics for the whole site. A client component only so it can
 * pass `beforeSend`, which keeps share and invoice pay link tokens out of
 * the page URLs it reports.
 */
export function VercelAnalytics() {
  return (
    <Analytics
      endpoint="/fuckoffaddblockers"
      scriptSrc="/fuckoffaddblocker/script.js"
      beforeSend={(event) => ({
        ...event,
        url: redactInvoiceToken(redactShareToken(event.url)),
      })}
    />
  );
}
