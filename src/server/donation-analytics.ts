import "server-only";

import { env } from "~/env";
import { donationCompletedEvent } from "~/lib/donation-analytics";

/** Run after the Stripe response so analytics cannot delay or fail a payment. */
export async function captureDonationCompleted(
  ...args: Parameters<typeof donationCompletedEvent>
) {
  const event = donationCompletedEvent(...args);
  if (!event) return;

  // Match the existing /ph proxy's ingestion region.
  const endpoint = "https://us.i.posthog.com/i/v0/e/";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: env.NEXT_PUBLIC_POSTHOG_KEY,
          ...event,
        }),
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok) return;
    } catch {
      // A second send keeps the same UUID; never log payment or receipt data.
    }
  }
  console.error("[donation analytics] conversion capture failed", event.uuid);
}
