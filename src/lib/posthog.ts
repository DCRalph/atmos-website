import posthog from "posthog-js";
import { env } from "~/env";
import { redactPaymentUrl } from "~/lib/donation-analytics";
import { redactInvoiceToken } from "~/lib/hire-invoices";
import {
  redactShareToken,
  shareTokenFromPath,
} from "~/lib/ticketing/share-link";

/** Call from effects, after hydration. Safe whichever client effect runs first. */
export function initPostHog() {
  if (posthog.__loaded) return;
  // A share link's address is its credential, and PostHog sends the landing
  // URL with more than events (the flags call carries it too), so it stays
  // off there. `before_send` still redacts, for a session that began elsewhere.
  // The same goes for a hire invoice's pay link.
  const path = window.location.pathname;
  if (shareTokenFromPath(path) || path.startsWith("/invoices/")) return;
  posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: "/ph",
    ui_host: "https://us.posthog.com",
    defaults: "2025-11-30",
    before_send: (event) => {
      if (!event) return null;
      for (const bag of [event.properties, event.$set, event.$set_once]) {
        if (!bag) continue;
        for (const [key, value] of Object.entries(bag)) {
          if (typeof value === "string") {
            bag[key] = redactInvoiceToken(
              redactShareToken(redactPaymentUrl(value)),
            );
          }
        }
      }
      return event;
    },
  });
}
