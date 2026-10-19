import { describe, expect, test } from "bun:test";

import {
  createDonationVisit,
  donationAnalyticsMetadata,
  donationAnalyticsSchema,
  donationCompletedEvent,
  readDonationAnalytics,
  redactPaymentUrl,
  type DonationAnalytics,
} from "./donation-analytics";

function visitHarness() {
  let time = 0;
  const events: {
    event: string;
    properties: Record<string, unknown>;
    immediate: boolean;
  }[] = [];
  const visit = createDonationVisit({
    properties: { gig_id: "gig-1", page_view_id: "view-1" },
    capture: (event, properties, immediate) => {
      events.push({ event, properties, immediate });
    },
    now: () => time,
  });
  return { visit, events, advance: (ms: number) => (time += ms) };
}

describe("donation engagement", () => {
  test("counts a visit once when React reattaches effects", () => {
    const { visit, events } = visitHarness();
    visit.start(null);
    visit.start(null);
    expect(events.map(({ event }) => event)).toEqual(["donation_page_viewed"]);
  });

  test("a paid redirect records a thank you without inflating visits", () => {
    const { visit, events } = visitHarness();
    visit.start(2000);
    visit.start(2000);
    expect(events.map(({ event }) => event)).toEqual([
      "donation_thank_you_viewed",
    ]);
  });

  test("pauses for hidden tabs and resumes without losing earlier time", () => {
    const { visit, events, advance } = visitHarness();
    visit.setVisible(true);
    advance(5000);
    visit.setVisible(false);
    visit.flush("hidden");
    advance(60_000);
    visit.setVisible(true);
    advance(3000);
    visit.flush("heartbeat");
    expect(events[1]?.properties.visible_seconds).toBe(8);
    expect(events[1]?.properties.visible_seconds_delta).toBe(3);
    expect(events[1]?.properties.elapsed_seconds).toBe(68);
    expect(events[0]?.immediate).toBe(true);
    expect(events[1]?.immediate).toBe(false);
  });

  test("heartbeats, pagehide, and route departure do not double count time", () => {
    const { visit, events, advance } = visitHarness();
    visit.setVisible(true);
    advance(15_000);
    visit.flush("heartbeat");
    advance(2000);
    visit.setVisible(false);
    visit.flush("hidden");
    visit.flush("pagehide");
    visit.flush("navigation");
    expect(
      events.map(({ properties }) => properties.visible_seconds_delta),
    ).toEqual([15, 2]);
    expect(events.at(-1)?.properties.visible_seconds).toBe(17);
  });

  test("background heartbeats report no extra engagement", () => {
    const { visit, events, advance } = visitHarness();
    advance(30_000);
    visit.flush("heartbeat");
    expect(events.length).toBe(0);
  });

  test("records the last step and time to payment without claiming conversion", () => {
    const { visit, events, advance } = visitHarness();
    visit.setVisible(true);
    advance(6000);
    visit.track("donation_payment_submitted", {
      amount_cents: 2000,
      payment_method: "card",
    });
    advance(1000);
    visit.flush("navigation");
    expect(events[0]?.properties.visible_seconds).toBe(6);
    expect(events[0]?.properties.elapsed_seconds).toBe(6);
    expect(events[1]?.properties.stage).toBe("payment");
    expect(events[1]?.properties.converted).toBe(false);
    expect(events.some(({ event }) => event === "donation_completed")).toBe(
      false,
    );
  });

  test("keeps the thank you separate from the server conversion", () => {
    const { visit, events, advance } = visitHarness();
    visit.setVisible(true);
    visit.track("donation_thank_you_viewed", { amount_cents: 2000 });
    advance(1000);
    visit.flush("heartbeat");
    expect(events.at(-1)?.properties.stage).toBe("completed");
    expect(events.at(-1)?.properties.converted).toBe(true);
    expect(events.some(({ event }) => event === "donation_completed")).toBe(
      false,
    );
  });
});

const analytics: DonationAnalytics = {
  distinct_id: "anonymous-visitor",
  session_id: "019a0000-0000-7000-8000-000000000001",
  page_view_id: "bdab1786-75c6-4c40-b4db-7c00ddc49059",
  amount_choice: "recommended",
  utm_source: "instagram",
  utm_medium: "social",
  utm_campaign: "spring-gig",
};
const intent = {
  id: "pi_donation_1",
  status: "succeeded" as const,
  amount_received: 2000,
  currency: "nzd",
  metadata: {
    kind: "donation",
    gigId: "gig-1",
    ...donationAnalyticsMetadata(analytics),
  },
};
const donation = {
  paidAt: new Date("2026-10-19T01:02:03Z"),
  paidWith: "APPLE_PAY",
};

describe("confirmed donation attribution", () => {
  test("carries anonymous visitor, visit, selection, and campaign through Stripe metadata", () => {
    expect(readDonationAnalytics(intent.metadata)).toEqual(analytics);
    const event = donationCompletedEvent(intent, donation);
    expect(event?.distinct_id).toBe(analytics.distinct_id);
    expect(event?.timestamp).toBe(donation.paidAt.toISOString());
    expect(event?.properties).toEqual({
      $session_id: analytics.session_id,
      page_view_id: analytics.page_view_id,
      gig_id: "gig-1",
      payment_id: intent.id,
      amount_choice: "recommended",
      utm_source: "instagram",
      utm_medium: "social",
      utm_campaign: "spring-gig",
      amount_cents: 2000,
      revenue: 20,
      currency: "NZD",
      payment_method: "APPLE_PAY",
      $process_person_profile: false,
      $ip: "0.0.0.0",
    });
  });

  test("uses the same event UUID and timestamp on webhook retries", () => {
    const first = donationCompletedEvent(intent, donation);
    expect(donationCompletedEvent(intent, donation)).toEqual(first);
    expect(
      donationCompletedEvent({ ...intent, id: "pi_donation_2" }, donation)
        ?.uuid === first?.uuid,
    ).toBe(false);
  });

  test("uses the amount actually received and excludes unpaid intents", () => {
    expect(
      donationCompletedEvent({ ...intent, amount_received: 3500 }, donation)
        ?.properties.revenue,
    ).toBe(35);
    expect(
      donationCompletedEvent({ ...intent, status: "processing" }, donation),
    ).toBe(null);
    expect(
      donationCompletedEvent(
        { ...intent, status: "requires_payment_method" },
        donation,
      ),
    ).toBe(null);
  });

  test("missing, opted-out, or invalid attribution is skipped", () => {
    expect(donationAnalyticsMetadata()).toEqual({});
    expect(
      Object.hasOwn(
        donationAnalyticsMetadata({ ...analytics, session_id: undefined }),
        "analytics_session_id",
      ),
    ).toBe(false);
    expect(
      donationCompletedEvent(
        { ...intent, metadata: { kind: "donation" } },
        donation,
      ),
    ).toBe(null);
    expect(readDonationAnalytics({ analytics_distinct_id: "invalid" })).toBe(
      null,
    );
    const optionalAnalytics = donationAnalyticsSchema
      .optional()
      .catch(undefined);
    expect(optionalAnalytics.parse({ distinct_id: "invalid" })).toBeUndefined();
  });

  test("strips receipt and payment secrets and bounds Stripe metadata values", () => {
    const parsed = donationAnalyticsSchema.parse({
      ...analytics,
      email: "donor@example.com",
      client_secret: "secret",
    });
    const metadata = donationAnalyticsMetadata(parsed);
    expect(Object.values(metadata).every((value) => value.length <= 500)).toBe(
      true,
    );
    expect(JSON.stringify(metadata).includes("donor@example.com")).toBe(false);
    expect(JSON.stringify(metadata).includes("secret")).toBe(false);
    expect(
      donationAnalyticsSchema.safeParse({
        ...analytics,
        utm_campaign: "x".repeat(501),
      }).success,
    ).toBe(false);
  });
});

describe("Stripe return URL privacy", () => {
  test("removes repeated payment and setup secrets while keeping campaign attribution", () => {
    const clean = redactPaymentUrl(
      "https://atmosmedia.co.nz/gigs/night/donate?utm_source=instagram&payment_intent=pi_1&payment_intent_client_secret=one&payment_intent_client_secret=two&setup_intent_client_secret=three#thanks",
    );
    expect(clean).toBe(
      "https://atmosmedia.co.nz/gigs/night/donate?utm_source=instagram&payment_intent=pi_1#thanks",
    );
  });

  test("leaves ordinary properties and URLs alone", () => {
    expect(
      redactPaymentUrl(
        "https://atmosmedia.co.nz/gigs/night/donate?utm_source=instagram",
      ),
    ).toBe("https://atmosmedia.co.nz/gigs/night/donate?utm_source=instagram");
    expect(redactPaymentUrl("amount_selected")).toBe("amount_selected");
  });
});
