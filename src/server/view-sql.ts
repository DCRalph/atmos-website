import { Prisma } from "~Prisma/client";

/**
 * SQL for counting page views by the calendar where they happened: today
 * from local midnight, this week from local Monday. Stored times are UTC
 * `timestamp`s without a zone, so each is marked UTC, then moved into the
 * zone, the same as the sales heatmaps do with `paidAt`.
 */

/** A UTC timestamp column as wall time in `timeZone`. */
export const localTime = (column: Prisma.Sql, timeZone: string) =>
  Prisma.sql`((${column} AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone})`;

/** Two counts of the rows, as `today` and `"thisWeek"`. */
export function todayAndThisWeek(column: Prisma.Sql, timeZone: string) {
  const local = localTime(column, timeZone);
  return Prisma.sql`
    COUNT(*) FILTER (WHERE ${local} >= date_trunc('day', now() AT TIME ZONE ${timeZone}))::int AS today,
    COUNT(*) FILTER (WHERE ${local} >= date_trunc('week', now() AT TIME ZONE ${timeZone}))::int AS "thisWeek"
  `;
}

export type TodayAndThisWeek = { today: number; thisWeek: number };
