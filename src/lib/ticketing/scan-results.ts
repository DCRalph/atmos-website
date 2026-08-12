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
 * Two lengths, because there are two places to read a result and they are not
 * the same reading. A ticket's full history is opened on purpose by somebody
 * with a question, and gets the sentence. A row in the live feed under the
 * camera is glanced at between scans and shares its line with a staff name and
 * a device, so it gets the phrase that survives being truncated.
 *
 * Client-safe.
 */

export type ScanResultTone = "in" | "out" | "bad" | "neutral";

const RESULTS: Record<
  TicketScanResult,
  { label: string; short: string; tone: ScanResultTone }
> = {
  ADMITTED: { label: "Admitted", short: "In", tone: "in" },
  REENTRY: { label: "Re-entry", short: "Re-entry", tone: "in" },
  OVERRIDE_ADMITTED: {
    label: "Admitted by override",
    short: "Let in anyway",
    tone: "in",
  },
  DUPLICATE: {
    label: "Turned back — already in",
    short: "Already in",
    tone: "out",
  },
  DENIED: { label: "Refused entry", short: "Refused", tone: "out" },
  PREVIOUSLY_DENIED: {
    label: "Turned back — refused earlier",
    short: "Scanned while refused",
    tone: "out",
  },
  ADMISSION_REVERTED: {
    label: "Admission undone",
    short: "Admission undone",
    tone: "neutral",
  },
  DEPARTED: { label: "Marked as left", short: "Left", tone: "neutral" },
  DENIAL_REVERTED: {
    label: "Refusal taken back",
    short: "Refusal taken back",
    tone: "neutral",
  },
  NOTE: { label: "Note", short: "Note", tone: "neutral" },
  INVALID_SIGNATURE: {
    label: "Code didn't check out",
    short: "Bad code",
    tone: "bad",
  },
  NOT_FOUND: { label: "Unknown code", short: "Unknown code", tone: "bad" },
  WRONG_EVENT: { label: "Wrong event", short: "Another event", tone: "bad" },
  VOIDED: { label: "Cancelled ticket", short: "Cancelled", tone: "bad" },
  REFUNDED_TICKET: {
    label: "Refunded ticket",
    short: "Refunded",
    tone: "bad",
  },
  ORDER_UNPAID: { label: "Order not paid", short: "Unpaid", tone: "bad" },
};

export function scanResultLabel(result: TicketScanResult): string {
  return RESULTS[result].label;
}

/** The same result, for a row that shares its line with three other facts. */
export function scanResultShort(result: TicketScanResult): string {
  return RESULTS[result].short;
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
