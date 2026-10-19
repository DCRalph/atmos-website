import posthog from "posthog-js";
import { env } from "~/env";
import { redactPaymentUrl } from "~/lib/donation-analytics";

/** Call from effects, after hydration. Safe whichever client effect runs first. */
export function initPostHog() {
  if (posthog.__loaded) return;
  posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: "/ph",
    ui_host: "https://us.posthog.com",
    defaults: "2025-11-30",
    before_send: (event) => {
      if (!event) return null;
      for (const bag of [event.properties, event.$set, event.$set_once]) {
        if (!bag) continue;
        for (const [key, value] of Object.entries(bag)) {
          if (typeof value === "string") bag[key] = redactPaymentUrl(value);
        }
      }
      return event;
    },
  });
}
