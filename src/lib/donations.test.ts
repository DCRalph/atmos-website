import { describe, expect, test } from "bun:test";

import { summariseDonations } from "./donations";

const at = (minute: number) => new Date(Date.UTC(2026, 9, 18, 9, minute));
const gift = (
  amountCents: number,
  minute: number,
  donorEmail: string | null = null,
  refundedCents = 0,
) => ({ amountCents, refundedCents, donorEmail, paidAt: at(minute) });

describe("summariseDonations", () => {
  test("totals net of refunds and counts people by email", () => {
    const summary = summariseDonations(
      [
        gift(2000, 1, "Mere@example.com"),
        gift(2000, 2, "mere@example.com"),
        gift(5000, 3, null, 5000),
        gift(1500, 4),
      ],
      [1000, 2000, 5000],
    );
    expect(summary.givenCents).toBe(10500);
    expect(summary.raisedCents).toBe(5500);
    expect(summary.people).toBe(3);
    expect(summary.averageCents).toBe(2625);
    expect(summary.largestCents).toBe(5000);
  });

  test("buckets picks by suggestion, with anything else as their own", () => {
    const summary = summariseDonations(
      [gift(2000, 1), gift(2000, 2), gift(1500, 3), gift(1000, 4)],
      [1000, 2000, 5000],
    );
    expect(summary.picks.map((pick) => pick.count)).toEqual([1, 2, 0, 1]);
    expect(summary.picks.at(-1)?.amountCents).toBe(null);
    expect(summary.mostPicked).toBe(1);
  });

  test("runs the total in time order whatever order rows arrive in", () => {
    const summary = summariseDonations(
      [gift(500, 9), gift(1000, 1, null, 1000), gift(2000, 5)],
      [],
    );
    expect(summary.cumulative.map((point) => point.cents)).toEqual([
      0, 2000, 2500,
    ]);
  });

  test("has no most picked before anybody gives", () => {
    const summary = summariseDonations([], [1000, 2000, 5000]);
    expect(summary.mostPicked).toBe(null);
    expect(summary.averageCents).toBe(0);
    expect(summary.largestCents).toBe(0);
  });
});
