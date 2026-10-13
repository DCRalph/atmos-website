import { describe, expect, test } from "bun:test";

import { bucketSeries, HOUR_MS } from "./analytics-range";

const NZ = "Pacific/Auckland";
const utc = (day: number, hour: number) =>
  new Date(Date.UTC(2026, 9, day, hour));

describe("bucketSeries", () => {
  test("a day or less is every hour, gaps as zeros", () => {
    const from = utc(10, 0);
    const to = utc(10, 5);
    const series = bucketSeries(
      [
        { at: utc(10, 1), n: 2 },
        // Mid-hour rows land in their hour.
        { at: new Date(utc(10, 1).getTime() + 30 * 60 * 1000), n: 1 },
        { at: utc(10, 4), n: 5 },
      ],
      from,
      to,
      NZ,
    );

    expect(series.map((slot) => slot.y)).toEqual([0, 3, 0, 0, 5, 0]);
    expect(series[1]!.x.getTime() - series[0]!.x.getTime()).toBe(HOUR_MS);
  });

  test("past a week goes daily, on New Zealand days rather than UTC ones", () => {
    // NZ is UTC+13 in October, so 10:00 UTC on the 10th is 11pm on the 10th
    // and 11:00 UTC is midnight into the 11th.
    const series = bucketSeries(
      [
        { at: utc(10, 10), n: 1 },
        { at: utc(10, 11), n: 4 },
      ],
      utc(1, 0),
      utc(20, 0),
      NZ,
    );

    const busy = series.filter((slot) => slot.y > 0);
    expect(busy.map((slot) => slot.y)).toEqual([1, 4]);
    expect(series.reduce((sum, slot) => sum + slot.y, 0)).toBe(5);
  });
});
