import type { z } from "zod";
import type { playbookItemSchema } from "./input";

/**
 * How a playbook reads: which phase of the run-up a task falls in, and how
 * far from the gig it is, in words. Shared by the playbook editor and the
 * apply preview so both describe a task the same way.
 */

export type PlaybookItem = z.input<typeof playbookItemSchema>;

const DAY = 1440;

/** The roles a new task suggests, before the playbook has any of its own. */
export const DEFAULT_PLAYBOOK_ROLES = ["lead", "promo", "design", "production"];

/** `6 weeks out`, `Gig week`, `Gig day`, `After the gig`. */
export function playbookPhase(offsetMinutes: number) {
  if (offsetMinutes > 0) return "After the gig";
  if (offsetMinutes > -DAY) return "Gig day";
  if (offsetMinutes > -7 * DAY) return "Gig week";
  const weeks = Math.floor(-offsetMinutes / (7 * DAY));
  return weeks === 1 ? "1 week out" : `${weeks} weeks out`;
}

/** `30 days before`, `6 hours before`, `On the day`, `1 day after`. */
export function formatOffset(offsetMinutes: number) {
  if (offsetMinutes === 0) return "On the day";
  const minutes = Math.abs(offsetMinutes);
  const side = offsetMinutes < 0 ? "before" : "after";
  if (minutes % DAY === 0) {
    const days = minutes / DAY;
    return `${days} ${days === 1 ? "day" : "days"} ${side}`;
  }
  const hours = Math.round(minutes / 60);
  return `${hours} ${hours === 1 ? "hour" : "hours"} ${side}`;
}

/** `42 days before to 3 days after`, from the first task to the last. */
export function playbookSpan(
  items: readonly Pick<PlaybookItem, "offsetMinutes">[],
) {
  if (items.length === 0) return "";
  const offsets = items.map((item) => item.offsetMinutes);
  const first = Math.min(...offsets);
  const last = Math.max(...offsets);
  return first === last
    ? formatOffset(first)
    : `${formatOffset(first)} to ${formatOffset(last)}`;
}

/** Every role a playbook asks for, owners and reviewers, in first-use order. */
export function playbookRoles(
  items: readonly Pick<PlaybookItem, "role" | "reviewerRole">[],
) {
  return [
    ...new Set(
      items.flatMap((item) =>
        [item.role, item.reviewerRole].filter((role): role is string => !!role),
      ),
    ),
  ];
}
