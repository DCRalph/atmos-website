/**
 * How far before doors tickets sell, in whole days. The server sends sparse
 * per-day rows (`days` is 0 on the day, 7 a week out, negative after doors);
 * this folds them into a handful of stretches with the share sold by the end
 * of each, so the page can say "38% had sold with a week to go".
 *
 * Client-safe.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Farthest first, which reads as a timeline down to the night. */
export const LEAD_TIME_BUCKETS = [
  { key: "28+", label: "4+ weeks out", from: 28 },
  { key: "14-27", label: "2–4 weeks out", from: 14 },
  { key: "7-13", label: "1–2 weeks out", from: 7 },
  { key: "3-6", label: "3–6 days out", from: 3 },
  { key: "1-2", label: "1–2 days out", from: 1 },
  { key: "0", label: "On the day", from: -Infinity },
] as const;

export type LeadTimeBucketKey = (typeof LEAD_TIME_BUCKETS)[number]["key"];

/** Which stretch a sale `days` before doors falls in. After doors is the day. */
export function leadTimeBucket(days: number): LeadTimeBucketKey {
  return LEAD_TIME_BUCKETS.find((bucket) => days >= bucket.from)!.key;
}

export type LeadTimeRow = {
  key: LeadTimeBucketKey;
  label: string;
  n: number;
  /** This stretch's share of the total. */
  share: number;
  /** The share sold by the end of this stretch, counting from the farthest. */
  soldBy: number;
};

/** Sparse per-day counts folded into the buckets, farthest first. */
export function bucketLeadTime(
  rows: { days: number; n: number }[],
): LeadTimeRow[] {
  const totals = new Map<LeadTimeBucketKey, number>();
  let total = 0;
  for (const row of rows) {
    const key = leadTimeBucket(row.days);
    totals.set(key, (totals.get(key) ?? 0) + row.n);
    total += row.n;
  }

  let running = 0;
  return LEAD_TIME_BUCKETS.map((bucket) => {
    const n = totals.get(bucket.key) ?? 0;
    running += n;
    return {
      key: bucket.key,
      label: bucket.label,
      n,
      share: total > 0 ? n / total : 0,
      soldBy: total > 0 ? running / total : 0,
    };
  });
}
