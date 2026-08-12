import type { TicketScanResult } from "~Prisma/client";

/**
 * What a row in a ticket's scan log means, in words a door can read.
 *
 * The enum names are written for the database. Somebody standing in a doorway
 * reading back a ticket's history is asking one question — did this person get
 * in, or didn't they — and `PREVIOUSLY_DENIED` is not that sentence.
 *
 * `tone` groups a result by what it meant for the person holding the ticket:
 * they went in, they were turned back, or the code itself never resolved to a
 * ticket at all. That is the distinction staff skim the list for, so it is the
 * one the colour carries.
 *
 * Client-safe.
 */

export type ScanResultTone = "in" | "out" | "bad" | "neutral";

const RESULTS: Record<
  TicketScanResult,
  { label: string; tone: ScanResultTone }
> = {
  ADMITTED: { label: "Admitted", tone: "in" },
  REENTRY: { label: "Re-entry", tone: "in" },
  OVERRIDE_ADMITTED: { label: "Admitted by override", tone: "in" },
  DUPLICATE: { label: "Turned back — already in", tone: "out" },
  DENIED: { label: "Refused entry", tone: "out" },
  PREVIOUSLY_DENIED: { label: "Turned back — refused earlier", tone: "out" },
  ADMISSION_REVERTED: { label: "Admission undone", tone: "neutral" },
  DENIAL_REVERTED: { label: "Refusal taken back", tone: "neutral" },
  NOTE: { label: "Note", tone: "neutral" },
  INVALID_SIGNATURE: { label: "Code didn't check out", tone: "bad" },
  NOT_FOUND: { label: "Unknown code", tone: "bad" },
  WRONG_EVENT: { label: "Wrong event", tone: "bad" },
  VOIDED: { label: "Cancelled ticket", tone: "bad" },
  REFUNDED_TICKET: { label: "Refunded ticket", tone: "bad" },
  ORDER_UNPAID: { label: "Order not paid", tone: "bad" },
};

export function scanResultLabel(result: TicketScanResult): string {
  return RESULTS[result].label;
}

export function scanResultTone(result: TicketScanResult): ScanResultTone {
  return RESULTS[result].tone;
}

/** Text colour for a history row, on the door's dark sheets. */
export const SCAN_TONE_TEXT: Record<ScanResultTone, string> = {
  in: "text-emerald-300",
  out: "text-red-300",
  bad: "text-amber-300",
  neutral: "text-white/70",
};
