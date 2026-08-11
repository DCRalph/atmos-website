import "server-only";

import { getKeyValue } from "~/server/feature-flags";
import {
  DEFAULT_GST_RATE_BP,
  ZERO_BOOKING_FEE,
  type BookingFeeConfig,
} from "~/lib/ticketing/money";

/**
 * Site-wide ticketing settings, stored in `KeyValueStore` so they can be
 * changed from the admin settings page without a deploy. Per-event overrides
 * live on the `TicketEvent` row and win when set.
 */

export const TICKETING_KEYS = {
  enabled: "ticketing.enabled",
  bookingFeeFixedCents: "ticketing.bookingFee.fixedCents",
  bookingFeePercentBp: "ticketing.bookingFee.percentBp",
  gstNumber: "ticketing.gstNumber",
  supportEmail: "ticketing.supportEmail",
  legalName: "ticketing.legalName",
  /** Minutes an unpaid order holds its inventory. */
  holdMinutes: "ticketing.holdMinutes",
} as const;

export const DEFAULT_HOLD_MINUTES = 10;

async function readInt(key: string, fallback: number): Promise<number> {
  const raw = await getKeyValue(key);
  if (raw === null) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export type TicketingSettings = {
  bookingFee: BookingFeeConfig;
  gstNumber: string | null;
  supportEmail: string | null;
  legalName: string;
  holdMinutes: number;
};

export async function getTicketingSettings(): Promise<TicketingSettings> {
  const [
    fixedCents,
    percentBp,
    gstNumber,
    supportEmail,
    legalName,
    holdMinutes,
  ] = await Promise.all([
    readInt(TICKETING_KEYS.bookingFeeFixedCents, ZERO_BOOKING_FEE.fixedCents),
    readInt(TICKETING_KEYS.bookingFeePercentBp, ZERO_BOOKING_FEE.percentBp),
    getKeyValue(TICKETING_KEYS.gstNumber),
    getKeyValue(TICKETING_KEYS.supportEmail),
    getKeyValue(TICKETING_KEYS.legalName),
    readInt(TICKETING_KEYS.holdMinutes, DEFAULT_HOLD_MINUTES),
  ]);

  return {
    bookingFee: { fixedCents, percentBp },
    gstNumber,
    supportEmail,
    legalName: legalName ?? "Atmos Media",
    holdMinutes: holdMinutes > 0 ? holdMinutes : DEFAULT_HOLD_MINUTES,
  };
}

/**
 * The booking fee that actually applies to an event: its own override when
 * either field is set, otherwise the site default.
 */
export function resolveBookingFee(
  event: {
    bookingFeeFixedCents: number | null;
    bookingFeePercentBp: number | null;
  },
  settings: TicketingSettings,
): BookingFeeConfig {
  const hasOverride =
    event.bookingFeeFixedCents !== null || event.bookingFeePercentBp !== null;
  if (!hasOverride) return settings.bookingFee;
  return {
    fixedCents: event.bookingFeeFixedCents ?? 0,
    percentBp: event.bookingFeePercentBp ?? 0,
  };
}

export function resolveGstRateBp(event: { gstRateBp: number | null }): number {
  return event.gstRateBp ?? DEFAULT_GST_RATE_BP;
}
