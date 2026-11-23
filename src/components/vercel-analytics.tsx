"use client";

import { Analytics } from "@vercel/analytics/next";

import { redactShareToken } from "~/lib/ticketing/share-link";

/**
 * Vercel Analytics for the whole site. A client component only so it can
 * pass `beforeSend`, which keeps share link tokens out of the page URLs it
 * reports.
 */
export function VercelAnalytics() {
  return (
    <Analytics
      endpoint="/fuckoffaddblockers"
      scriptSrc="/fuckoffaddblocker/script.js"
      beforeSend={(event) => ({ ...event, url: redactShareToken(event.url) })}
    />
  );
}
