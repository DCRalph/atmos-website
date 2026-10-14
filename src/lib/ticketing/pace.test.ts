import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { DAY_MS } from "./lead-time";
import { averagePace, paceOnAxis } from "./pace";

describe("pace", () => {
  test("averages the running total across events, zero before an event sold", () => {
    const pace = averagePace([
      // Event a sold 10 two days out and 10 on the day.
      { eventId: "a", days: 2, tickets: 10, revenueCents: 1000 },
      { eventId: "a", days: 0, tickets: 10, revenueCents: 1000 },
      // Event b sold 4 on the day, and 2 after doors, which count as the day.
      { eventId: "b", days: 0, tickets: 4, revenueCents: 400 },
      { eventId: "b", days: -1, tickets: 2, revenueCents: 200 },
    ]);
    assert.equal(pace.events, 2);
    assert.deepEqual(
      pace.points.map((point) => [point.days, point.tickets]),
      [
        [2, 5],
        [1, 5],
        [0, 13],
      ],
    );
    assert.equal(pace.points.at(-1)!.revenueCents, 1300);
  });

  test("no past events means no line", () => {
    assert.deepEqual(averagePace([]), { events: 0, points: [] });
  });

  test("lays the line on the event's axis, held flat at both edges", () => {
    const startsAt = new Date("2026-10-10T08:00:00Z");
    const points = [
      { days: 3, tickets: 2, revenueCents: 0 },
      { days: 1, tickets: 6, revenueCents: 0 },
      { days: 0, tickets: 9, revenueCents: 0 },
    ];
    const from = new Date(startsAt.getTime() - 2 * DAY_MS);
    const to = new Date(startsAt.getTime() + DAY_MS);
    const line = paceOnAxis(points, startsAt, from, to);
    assert.deepEqual(
      line.map((point) => [point.at.toISOString(), point.tickets]),
      [
        // Two days out the average event sat at the three-day figure.
        [from.toISOString(), 2],
        ["2026-10-09T08:00:00.000Z", 6],
        ["2026-10-10T08:00:00.000Z", 9],
        // After doors it holds at the final figure.
        [to.toISOString(), 9],
      ],
    );
  });
});
