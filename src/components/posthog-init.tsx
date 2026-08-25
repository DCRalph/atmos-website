"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { env } from "~/env";

/**
 * PostHog is initialised from an effect (not `instrumentation-client.ts`) on
 * purpose: posthog-js injects its remote-config <script> next to the first
 * script in the document — the StripTicketHash inline script at the top of
 * <body> — and doing that before React hydrates makes React find an element
 * it didn't render and throw the whole server tree away (a visible re-render
 * flash on every page). Effects run after hydration commits, so this is the
 * earliest point that is guaranteed safe.
 */
export function PostHogInit() {
  useEffect(() => {
    if (posthog.__loaded) return; // hot reload / strict-mode double mount
    posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: "/ph",
      ui_host: "https://us.posthog.com",
      defaults: "2025-11-30",
    });
  }, []);
  return null;
}
