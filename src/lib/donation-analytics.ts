import { z } from "zod";
import { v5 as uuidv5 } from "uuid";
import type Stripe from "stripe";

/** Only anonymous attribution goes to Stripe. Receipt and card fields stay out. */
export const donationAnalyticsSchema = z.object({
  distinct_id: z.string().min(1).max(200),
  session_id: z.uuid().optional(),
  page_view_id: z.uuid(),
  amount_choice: z.enum(["recommended", "suggested", "custom"]),
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(100).optional(),
});

export type DonationAnalytics = z.infer<typeof donationAnalyticsSchema>;
export type DonationAmountChoice = DonationAnalytics["amount_choice"];

export function donationAnalyticsMetadata(analytics?: DonationAnalytics) {
  return Object.fromEntries(
    Object.entries(analytics ?? {})
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [`analytics_${key}`, value]),
  );
}

export function readDonationAnalytics(metadata: Record<string, string>) {
  const parsed = donationAnalyticsSchema.safeParse(
    Object.fromEntries(
      Object.entries(metadata)
        .filter(([key]) => key.startsWith("analytics_"))
        .map(([key, value]) => [key.slice("analytics_".length), value]),
    ),
  );
  return parsed.success ? parsed.data : null;
}

/** Stable UUID and payment time let webhook retries describe the same conversion. */
export function donationCompletedEvent(
  intent: Pick<
    Stripe.PaymentIntent,
    "id" | "metadata" | "status" | "amount_received" | "currency"
  >,
  donation: { paidAt: Date; paidWith: string | null },
) {
  const analytics = readDonationAnalytics(intent.metadata);
  if (!analytics || intent.status !== "succeeded") return null;
  const { distinct_id, session_id, ...attribution } = analytics;
  return {
    uuid: uuidv5(`donation_completed:${intent.id}`, uuidv5.URL),
    event: "donation_completed",
    distinct_id,
    timestamp: donation.paidAt.toISOString(),
    properties: {
      ...attribution,
      gig_id: intent.metadata.gigId,
      payment_id: intent.id,
      amount_cents: intent.amount_received,
      revenue: intent.amount_received / 100,
      currency: intent.currency.toUpperCase(),
      payment_method: donation.paidWith,
      $session_id: session_id,
      $process_person_profile: false,
      $ip: "0.0.0.0",
    },
  };
}

type Amount = {
  amount_cents: number | null;
  amount_choice: DonationAmountChoice;
};
type Payment = { amount_cents: number; payment_method: string };
type Failure = {
  stage: "amount" | "email" | "loading" | "validation" | "intent" | "payment";
  error_code: string;
};

export type DonationEvents = {
  donation_page_viewed: { is_payment_return: boolean };
  donation_amount_selected: Amount;
  donation_checkout_started: Amount & { payment_method: string };
  donation_amount_revisited: Record<string, never>;
  donation_wallets_available: { payment_methods: string[] };
  donation_wallet_cancelled: Record<string, never>;
  donation_payment_submitted: Payment;
  donation_payment_failed: Failure;
  donation_payment_processing: Payment;
  donation_thank_you_viewed: { amount_cents: number };
};

type EventProperties = Record<
  string,
  string | number | boolean | null | string[]
>;

/** Visible time only, with deltas so heartbeats and exits can safely be summed. */
export function createDonationVisit({
  properties,
  capture,
  now = () => performance.now(),
}: {
  properties: EventProperties;
  capture: (
    event: string,
    properties: EventProperties,
    immediate: boolean,
  ) => void;
  now?: () => number;
}) {
  const startedAt = now();
  let visibleAt: number | null = null;
  let visibleMs = 0;
  let reportedMs = 0;
  let stage = "viewed";
  let converted = false;
  let started = false;

  const timing = () => ({
    elapsed_seconds: Math.round((now() - startedAt) / 1000),
    visible_seconds:
      Math.round(
        (visibleMs + (visibleAt === null ? 0 : now() - visibleAt)) / 10,
      ) / 100,
  });

  const track = <E extends keyof DonationEvents>(
    event: E,
    details: DonationEvents[E],
  ) => {
    if (event === "donation_amount_selected") stage = "amount";
    if (event === "donation_amount_revisited") stage = "amount";
    if (event === "donation_checkout_started") stage = "checkout";
    if (event === "donation_payment_submitted") stage = "payment";
    if (event === "donation_thank_you_viewed") {
      stage = "completed";
      converted = true;
    }
    capture(event, { ...properties, ...timing(), ...details }, false);
  };

  return {
    track,
    start(thankedCents: number | null) {
      if (started) return;
      started = true;
      // A Stripe return is a continuation, not another visitor to the ask.
      if (thankedCents === null) {
        track("donation_page_viewed", { is_payment_return: false });
      } else {
        track("donation_thank_you_viewed", { amount_cents: thankedCents });
      }
    },
    setVisible(visible: boolean) {
      if (visible && visibleAt === null) visibleAt = now();
      if (!visible && visibleAt !== null) {
        visibleMs += now() - visibleAt;
        visibleAt = null;
      }
    },
    flush(reason: "heartbeat" | "hidden" | "pagehide" | "navigation") {
      const currentMs =
        visibleMs + (visibleAt === null ? 0 : now() - visibleAt);
      const deltaMs = currentMs - reportedMs;
      if (deltaMs < 10) return;
      reportedMs = currentMs;
      capture(
        "donation_page_engagement",
        {
          ...properties,
          ...timing(),
          visible_seconds_delta: Math.round(deltaMs / 10) / 100,
          stage,
          converted,
          reason,
        },
        reason !== "heartbeat",
      );
    },
  };
}

/** Stripe adds secrets to return URLs; these must never enter analytics. */
export function redactPaymentUrl(value: string) {
  try {
    const url = new URL(value);
    let changed = false;
    for (const key of [
      "payment_intent_client_secret",
      "setup_intent_client_secret",
    ]) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    return changed ? url.toString() : value;
  } catch {
    return value;
  }
}
