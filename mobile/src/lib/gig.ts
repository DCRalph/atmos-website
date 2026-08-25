import type { GigMode } from "~Prisma/client";

import { formatGigDate, formatGigDateLong, formatGigTime } from "@/lib/dates";

/**
 * When a gig is, as a person would say it.
 *
 * A gig in `TO_BE_ANNOUNCED` mode is a placeholder for a date nobody has picked
 * yet, and `gigStartTime` is not nullable — so an unannounced gig carries a
 * stand-in timestamp, which used to reach the app's cards verbatim and render a
 * past show dated 1 January 1970. The website already reads `mode` before it
 * prints a date; these are the same rule, for the app.
 */
export function isTba(gig: { mode: GigMode }): boolean {
  return gig.mode === "TO_BE_ANNOUNCED";
}

/** Short form, for a card: "Sat 28 Jun" or "Date TBA". */
export function gigWhen(gig: { mode: GigMode; gigStartTime: Date }): string {
  return isTba(gig) ? "Date TBA" : formatGigDate(gig.gigStartTime);
}

/** Long form with a time, for a detail screen or a hero card. */
export function gigWhenLong(gig: {
  mode: GigMode;
  gigStartTime: Date;
}): string {
  return isTba(gig)
    ? "Date to be announced"
    : `${formatGigDateLong(gig.gigStartTime)} · ${formatGigTime(gig.gigStartTime)}`;
}
