import type { TicketDenyReason } from "~Prisma/client";

/**
 * The reasons the door can pick from when turning someone away.
 *
 * Shared by the scanner UI and the router that validates the choice, so the
 * buttons on the phone and the values the database will accept can never drift
 * apart. Ordered by how often a door actually uses them — the top of the list
 * is where a thumb lands first.
 */

export const DENY_REASONS = [
  { value: "INTOXICATED", label: "Too intoxicated" },
  { value: "NO_ID", label: "No / bad ID" },
  { value: "UNDERAGE", label: "Underage" },
  { value: "BEHAVIOUR", label: "Behaviour" },
  { value: "DRESS_CODE", label: "Dress code" },
  { value: "BANNED", label: "Banned / removed" },
  { value: "WRONG_PERSON", label: "Not their ticket" },
  { value: "OTHER", label: "Other" },
] as const satisfies readonly { value: TicketDenyReason; label: string }[];

export type DenyReasonValue = (typeof DENY_REASONS)[number]["value"];

export const DENY_REASON_VALUES = DENY_REASONS.map(
  (reason) => reason.value,
) satisfies DenyReasonValue[];

const LABELS = new Map<string, string>(
  DENY_REASONS.map((reason) => [reason.value, reason.label]),
);

export function denyReasonLabel(value: string | null | undefined): string {
  if (!value) return "Refused entry";
  return LABELS.get(value) ?? "Refused entry";
}
