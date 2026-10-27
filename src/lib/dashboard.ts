import type { TaskStatus } from "~/lib/tasks/status";

/**
 * The rules behind the admin dashboard, kept pure so they can be tested
 * without a database: why a task is in someone's queue, and what a night
 * still needs before it can go ahead. The data itself is gathered by
 * `dashboardOverview` in `~/server/dashboard.ts`.
 */

/** How far ahead Coming up looks, in days. */
export const COMING_UP_DAYS = 30;
/** How long a finished night keeps its wrap-up items, in days. */
export const WRAP_UP_DAYS = 7;

/** The task fields the queue reads. `readTasks` rows satisfy it. */
export type QueueTask = {
  status: TaskStatus;
  assigneeId: string | null;
  reviewerId: string | null;
  waiting: boolean;
  overdue: boolean;
  dueSoon: boolean;
  atRisk: boolean;
  unassigned: boolean;
  escalated: boolean;
  checkBackAt: Date | null;
};

export type YourTaskReason =
  "review" | "check-back" | "overdue" | "at-risk" | "due-soon";

export type TeamTaskReason = "at-risk" | "unassigned" | "overdue" | "blocked";

/**
 * Why a task needs this person, or null when it doesn't yet. Work waiting on
 * another task, and a block whose check-back time hasn't come, are left out:
 * there is nothing for them to do about either.
 */
export function yourTaskReason(
  task: QueueTask,
  userId: string,
  now: Date,
): YourTaskReason | null {
  if (task.status === "IN_REVIEW") {
    return task.reviewerId === userId ? "review" : null;
  }
  if (task.assigneeId !== userId || task.waiting) return null;
  if (task.status === "BLOCKED") {
    return task.checkBackAt && task.checkBackAt <= now ? "check-back" : null;
  }
  if (!isActionable(task.status)) return null;
  if (task.overdue) return "overdue";
  if (task.atRisk) return "at-risk";
  if (task.dueSoon) return "due-soon";
  return null;
}

/** What a `taskAlerts` row is flagged for, for the team half of the queue. */
export function teamTaskReason(task: QueueTask): TeamTaskReason {
  if (task.atRisk) return "at-risk";
  if (task.unassigned) return "unassigned";
  if (task.status === "BLOCKED") return "blocked";
  return "overdue";
}

function isActionable(status: TaskStatus) {
  return status === "TODO" || status === "IN_PROGRESS";
}

/** What a night has, for its readiness check in Coming up. */
export type NightFacts = {
  /** Null on a ticketed event with no gig behind it. */
  gig: {
    isDraft: boolean;
    isAffiliated: boolean;
    hasPoster: boolean;
    hasVenue: boolean;
    hasTicketLink: boolean;
    scheduleRows: number;
    timedRows: number;
    /** Cue recipients with no phone registered, who will hear nothing. */
    recipientsWithoutApp: number;
  } | null;
  event: {
    isDraft: boolean;
    hasPoster: boolean;
    hasVenue: boolean;
    doorStaff: number;
  } | null;
};

export type NightCheck = {
  label: string;
  /** `ok` is done, `warn` is worth fixing, `bad` stops the night going ahead. */
  state: "ok" | "warn" | "bad";
};

/**
 * What a night still needs. Problems come first. Someone else's night we are
 * only on the bill for is not ours to run, so it skips the run sheet, the door
 * and the tickets.
 */
export function nightChecks({ gig, event }: NightFacts): NightCheck[] {
  const checks: NightCheck[] = [];
  const ours = !gig?.isAffiliated;

  if (gig?.isDraft) checks.push({ label: "Gig is a draft", state: "bad" });
  if (event?.isDraft) checks.push({ label: "Event is a draft", state: "bad" });

  const hasPoster = !!gig?.hasPoster || !!event?.hasPoster;
  checks.push(
    hasPoster
      ? { label: "Poster", state: "ok" }
      : { label: "No poster", state: "warn" },
  );
  const hasVenue = !!gig?.hasVenue || !!event?.hasVenue;
  checks.push(
    hasVenue
      ? { label: "Venue", state: "ok" }
      : { label: "No venue", state: "warn" },
  );

  if (gig && ours) {
    if (gig.scheduleRows === 0) {
      checks.push({ label: "No run sheet", state: "warn" });
    } else if (gig.timedRows === 0) {
      checks.push({ label: "Run sheet has no times", state: "warn" });
    } else {
      checks.push({ label: "Run sheet", state: "ok" });
    }
    if (gig.scheduleRows > 0 && gig.recipientsWithoutApp > 0) {
      checks.push({
        label: `${gig.recipientsWithoutApp} on cues without the app`,
        state: "warn",
      });
    }
    if (!event && !gig.hasTicketLink) {
      checks.push({ label: "No tickets", state: "warn" });
    }
  }

  if (event && ours) {
    checks.push(
      event.doorStaff > 0
        ? { label: "Door staff", state: "ok" }
        : { label: "No door staff", state: "warn" },
    );
  }

  const order = { bad: 0, warn: 1, ok: 2 } as const;
  return checks.sort((a, b) => order[a.state] - order[b.state]);
}
