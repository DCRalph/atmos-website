/**
 * Time ranges for the admin charts: event sales, link clicks, donations.
 *
 * Servers send sparse hourly rows and `bucketSeries` lays them onto a full
 * axis here, so every chart buckets the same way. Lines plot every hour at any
 * range; bars go daily past a week, because 720 hourly bars would each be
 * under a pixel wide.
 *
 * Client-safe.
 */

export const ANALYTICS_RANGES = ["24h", "7d", "30d", "all"] as const;

export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export const ANALYTICS_RANGE_LABELS: Record<AnalyticsRange, string> = {
  "24h": "24h",
  "7d": "7d",
  "30d": "30d",
  all: "All",
};

export const HOUR_MS = 60 * 60 * 1000;
const RANGE_HOURS = { "24h": 24, "7d": 7 * 24, "30d": 30 * 24 } as const;

/** Where a range starts when it ends at `end`. Null for all time. */
export function rangeStart(range: AnalyticsRange, end: Date): Date | null {
  return range === "all"
    ? null
    : new Date(end.getTime() - RANGE_HOURS[range] * HOUR_MS);
}

export const floorHour = (date: Date) =>
  new Date(Math.floor(date.getTime() / HOUR_MS) * HOUR_MS);

/** Hours up to a week, days beyond. */
export function bucketUnit(from: Date, to: Date): "hour" | "day" {
  return to.getTime() - from.getTime() <= RANGE_HOURS["7d"] * HOUR_MS
    ? "hour"
    : "day";
}

/**
 * Sparse hourly counts laid onto every slot from `from` to `to`, zeros
 * included, so a quiet stretch is visibly quiet. Days are the event's own
 * calendar days, not UTC ones.
 */
export function bucketSeries(
  rows: { at: Date; n: number }[],
  from: Date,
  to: Date,
  timeZone: string,
): { x: Date; y: number }[] {
  const byHour = new Map<number, number>();
  for (const row of rows) {
    const hour = floorHour(row.at).getTime();
    byHour.set(hour, (byHour.get(hour) ?? 0) + row.n);
  }

  const hourly: { x: Date; y: number }[] = [];
  for (let at = floorHour(from).getTime(); at <= to.getTime(); at += HOUR_MS) {
    hourly.push({ x: new Date(at), y: byHour.get(at) ?? 0 });
  }
  if (bucketUnit(from, to) === "hour") return hourly;

  // One formatter for every slot: building one per call is the slow part.
  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone });
  const days: { key: string; x: Date; y: number }[] = [];
  for (const slot of hourly) {
    const key = dayKey.format(slot.x);
    const day = days.at(-1);
    if (day?.key === key) day.y += slot.y;
    else days.push({ key, x: slot.x, y: slot.y });
  }
  return days.map(({ x, y }) => ({ x, y }));
}
