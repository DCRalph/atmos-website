import { DEFAULT_EVENT_TIMEZONE } from "~/lib/ticketing/dates";
import {
  dateToZonedWallTime,
  zonedWallTimeToDate,
} from "~/lib/gig-import/zoned-time";

/** The windows the payments page offers, in the order it shows them. */
export const PAYMENT_RANGES = ["7d", "30d", "year", "all"] as const;

export type PaymentRange = (typeof PAYMENT_RANGES)[number];

export const PAYMENT_RANGE_LABELS: Record<PaymentRange, string> = {
  "7d": "7 days",
  "30d": "30 days",
  year: "This year",
  all: "All time",
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When a range starts, or null for all time. "This year" is from New Year in
 * New Zealand, not in the server's UTC, so a 1 January gig lands in the year
 * it happened in.
 */
export function paymentRangeStart(range: PaymentRange, now = new Date()) {
  switch (range) {
    case "7d":
      return new Date(now.getTime() - 7 * DAY_MS);
    case "30d":
      return new Date(now.getTime() - 30 * DAY_MS);
    case "year": {
      const year = dateToZonedWallTime(now, DEFAULT_EVENT_TIMEZONE).slice(0, 4);
      return zonedWallTimeToDate(`${year}-01-01T00:00`, DEFAULT_EVENT_TIMEZONE);
    }
    case "all":
      return null;
  }
}
