"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import posthog from "posthog-js";
import {
  createDonationVisit,
  donationAnalyticsSchema,
  redactPaymentUrl,
  type DonationAmountChoice,
  type DonationEvents,
} from "~/lib/donation-analytics";
import { initPostHog } from "~/lib/posthog";

function useVisit(
  gigId: string,
  gigTitle: string,
  thankedCents: number | null,
) {
  const visit = useRef<ReturnType<typeof createDonationVisit> | null>(null);
  const attribution = useRef<Record<string, string>>({});
  const pageViewId = useRef<string | null>(null);
  const attached = useRef(false);

  useEffect(() => {
    // Clean before starting analytics/session replay, including Vercel's sibling effect.
    const cleanUrl = redactPaymentUrl(window.location.href);
    if (cleanUrl !== window.location.href) {
      const historyState: unknown = window.history.state;
      window.history.replaceState(historyState, "", cleanUrl);
    }
    initPostHog();
    pageViewId.current ??= crypto.randomUUID();
    const query = new URLSearchParams(window.location.search);
    attribution.current = {};
    for (const key of ["utm_source", "utm_medium", "utm_campaign"]) {
      const value = query.get(key);
      if (value) attribution.current[key] = value.slice(0, 100);
    }
    visit.current ??= createDonationVisit({
      properties: {
        gig_id: gigId,
        gig_title: gigTitle,
        page_view_id: pageViewId.current,
        page_path: window.location.pathname,
        currency: "NZD",
        ...attribution.current,
      },
      capture: (event, properties, immediate) => {
        posthog.capture(
          event,
          properties,
          immediate
            ? { transport: "sendBeacon", send_instantly: true }
            : undefined,
        );
      },
    });
    const current = visit.current;
    attached.current = true;
    current.start(thankedCents);
    const visibility = () => {
      const visible = document.visibilityState === "visible";
      current.setVisible(visible);
      if (!visible) current.flush("hidden");
    };
    const pagehide = () => {
      current.setVisible(false);
      current.flush("pagehide");
    };
    visibility();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pagehide);
    window.addEventListener("pageshow", visibility);
    const heartbeat = window.setInterval(
      () => current.flush("heartbeat"),
      15_000,
    );
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", pagehide);
      window.removeEventListener("pageshow", visibility);
      window.clearInterval(heartbeat);
      current.setVisible(false);
      // React's Strict Mode immediately reattaches this same visit. Let that
      // happen before deciding this was a real route departure.
      attached.current = false;
      queueMicrotask(() => {
        if (!attached.current) current.flush("navigation");
      });
    };
  }, [gigId, gigTitle, thankedCents]);

  const track = useCallback(
    <E extends keyof DonationEvents>(
      event: E,
      properties: DonationEvents[E],
    ) => {
      visit.current?.track(event, properties);
    },
    [],
  );
  const paymentContext = useCallback((amountChoice: DonationAmountChoice) => {
    if (!pageViewId.current || posthog.has_opted_out_capturing())
      return undefined;
    const parsed = donationAnalyticsSchema.safeParse({
      distinct_id: posthog.get_distinct_id(),
      session_id: posthog.get_session_id(),
      page_view_id: pageViewId.current,
      amount_choice: amountChoice,
      ...attribution.current,
    });
    return parsed.success ? parsed.data : undefined;
  }, []);
  return { track, paymentContext };
}

const DonationAnalyticsContext = createContext<ReturnType<
  typeof useVisit
> | null>(null);

export function DonationAnalyticsProvider({
  gigId,
  gigTitle,
  thankedCents,
  children,
}: {
  gigId: string;
  gigTitle: string;
  thankedCents: number | null;
  children: ReactNode;
}) {
  const analytics = useVisit(gigId, gigTitle, thankedCents);
  return (
    <DonationAnalyticsContext value={analytics}>
      {children}
    </DonationAnalyticsContext>
  );
}

export function useDonationAnalytics() {
  const analytics = useContext(DonationAnalyticsContext);
  if (!analytics) throw new Error("Donation analytics provider is missing");
  return analytics;
}
