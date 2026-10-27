import type { z } from "zod";
import type { playbookItemSchema } from "./input";
import { projectSchedule, type Dependency } from "./schedule";

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

/** Work before the gig cannot slip past its start. Wrap-up after it can. */
export function playbookHardDeadline(offsetMinutes: number, gigStart: Date) {
  return offsetMinutes <= 0 ? gigStart : null;
}

/**
 * A playbook's dependencies between its own keys, each with the gap its
 * offsets imply, so a task that waits on another keeps the same distance
 * from it when the first one slips.
 */
export function playbookDependencies(
  items: readonly Pick<PlaybookItem, "key" | "offsetMinutes" | "dependsOn">[],
): Dependency[] {
  const offsets = new Map(items.map((item) => [item.key, item.offsetMinutes]));
  return items.flatMap((item) =>
    (item.dependsOn ?? []).map((key) => ({
      taskId: item.key,
      dependsOnId: key,
      gapMinutes: Math.max(0, item.offsetMinutes - (offsets.get(key) ?? 0)),
    })),
  );
}

/**
 * What applying a playbook to a gig would make, before anything is written:
 * each task's deadline, and where the schedule puts it straight away once
 * anything it waits for is already late. In date order.
 */
export function playbookPlan<
  T extends Pick<PlaybookItem, "key" | "title" | "offsetMinutes" | "dependsOn">,
>(items: readonly T[], gigStart: Date, now: Date) {
  const tasks = items.map((item) => {
    const dueAt = new Date(gigStart.getTime() + item.offsetMinutes * 60_000);
    return {
      id: item.key,
      title: item.title,
      status: "TODO" as const,
      assigneeId: null,
      dueAt,
      plannedDueAt: dueAt,
      hardDeadlineAt: playbookHardDeadline(item.offsetMinutes, gigStart),
      completedAt: null,
      submittedAt: null,
    };
  });
  const projected = projectSchedule(tasks, playbookDependencies(items), now);
  return items
    .map((item, index) => {
      const dueAt = tasks[index]!.dueAt;
      const projection = projected.get(item.key)!;
      return {
        item,
        dueAt,
        /** Later than `dueAt` when something it waits for is already late. */
        projectedAt: projection.projectedDueAt,
        atRisk: projection.atRisk,
      };
    })
    .sort((a, b) => a.item.offsetMinutes - b.item.offsetMinutes);
}
