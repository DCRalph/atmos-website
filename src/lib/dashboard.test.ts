import { describe, expect, test } from "bun:test";
import {
  nightChecks,
  yourTaskReason,
  type NightFacts,
  type QueueTask,
} from "./dashboard";

const now = new Date("2026-10-31T09:42:00Z");
const task = (overrides: Partial<QueueTask> = {}): QueueTask => ({
  status: "TODO",
  assigneeId: "me",
  reviewerId: null,
  waiting: false,
  overdue: false,
  dueSoon: false,
  atRisk: false,
  unassigned: false,
  escalated: false,
  checkBackAt: null,
  ...overrides,
});

describe("yourTaskReason", () => {
  test("a review belongs to the reviewer, not the person who submitted it", () => {
    const review = task({
      status: "IN_REVIEW",
      reviewerId: "me",
      assigneeId: "josh",
    });
    expect(yourTaskReason(review, "me", now)).toBe("review");
    expect(yourTaskReason(review, "josh", now)).toBe(null);
  });

  test("a block only comes back once its check-back time has passed", () => {
    const blocked = (checkBackAt: Date) =>
      task({ status: "BLOCKED", overdue: true, checkBackAt });
    expect(
      yourTaskReason(blocked(new Date(now.getTime() - 60_000)), "me", now),
    ).toBe("check-back");
    expect(
      yourTaskReason(blocked(new Date(now.getTime() + 60_000)), "me", now),
    ).toBe(null);
  });

  test("work waiting on another task is left out, however late", () => {
    expect(
      yourTaskReason(task({ waiting: true, overdue: true }), "me", now),
    ).toBe(null);
    expect(
      yourTaskReason(task({ overdue: true, dueSoon: true }), "me", now),
    ).toBe("overdue");
    expect(yourTaskReason(task({ overdue: true }), "ana", now)).toBe(null);
  });
});

describe("nightChecks", () => {
  const gig: NonNullable<NightFacts["gig"]> = {
    isDraft: false,
    isAffiliated: false,
    hasPoster: true,
    hasVenue: true,
    hasTicketLink: false,
    scheduleRows: 4,
    timedRows: 0,
    recipientsWithoutApp: 2,
  };
  const event: NonNullable<NightFacts["event"]> = {
    isDraft: true,
    hasPoster: false,
    hasVenue: true,
    doorStaff: 0,
  };

  test("problems come first, and a poster on either the gig or the event counts", () => {
    expect(nightChecks({ gig, event })).toEqual([
      { label: "Event is a draft", state: "bad" },
      { label: "Run sheet has no times", state: "warn" },
      { label: "2 on cues without the app", state: "warn" },
      { label: "No door staff", state: "warn" },
      { label: "Poster", state: "ok" },
      { label: "Venue", state: "ok" },
    ]);
  });

  test("someone else's night skips the run sheet, the door and the tickets", () => {
    expect(
      nightChecks({ gig: { ...gig, isAffiliated: true }, event: null }),
    ).toEqual([
      { label: "Poster", state: "ok" },
      { label: "Venue", state: "ok" },
    ]);
  });

  test("our own gig with no event and no ticket link has no way in", () => {
    expect(
      nightChecks({
        gig: { ...gig, timedRows: 4, recipientsWithoutApp: 0 },
        event: null,
      }),
    ).toEqual([
      { label: "No tickets", state: "warn" },
      { label: "Poster", state: "ok" },
      { label: "Venue", state: "ok" },
      { label: "Run sheet", state: "ok" },
    ]);
  });
});
