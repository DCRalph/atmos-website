import { DAY_MS } from "./lead-time";

/**
 * The pace line on an event's sales curve: what the average past event had
 * sold at each number of days before doors, laid onto this event's axis.
 *
 * Client-safe; the server runs `averagePace` and the chart runs `paceOnAxis`.
 */

export type PaceRow = {
  eventId: string;
  /** Whole days before doors. Negative is after doors. */
  days: number;
  tickets: number;
  revenueCents: number;
};

export type PacePoint = { days: number; tickets: number; revenueCents: number };

/**
 * Average cumulative sales across events at each days-out, from the farthest
 * any of them sold down to the day, farthest first. An event that hadn't
 * started selling yet counts as zero: that is what the average event had sold
 * by then. Sales after doors count on the day.
 */
export function averagePace(rows: PaceRow[]): {
  events: number;
  points: PacePoint[];
} {
  const byEvent = new Map<string, Map<number, PacePoint>>();
  let farthest = 0;
  for (const row of rows) {
    const days = Math.max(0, row.days);
    farthest = Math.max(farthest, days);
    const perDay = byEvent.get(row.eventId) ?? new Map<number, PacePoint>();
    const day = perDay.get(days) ?? { days, tickets: 0, revenueCents: 0 };
    day.tickets += row.tickets;
    day.revenueCents += row.revenueCents;
    perDay.set(days, day);
    byEvent.set(row.eventId, perDay);
  }

  const events = byEvent.size;
  if (events === 0) return { events: 0, points: [] };

  const points: PacePoint[] = [];
  for (let days = farthest; days >= 0; days--) {
    points.push({ days, tickets: 0, revenueCents: 0 });
  }
  // Walk each event from far out to the day, carrying its running total.
  for (const perDay of byEvent.values()) {
    let tickets = 0;
    let revenueCents = 0;
    for (const point of points) {
      const day = perDay.get(point.days);
      tickets += day?.tickets ?? 0;
      revenueCents += day?.revenueCents ?? 0;
      point.tickets += tickets / events;
      point.revenueCents += revenueCents / events;
    }
  }
  return { events, points };
}

export type PaceOnAxisPoint = {
  at: Date;
  tickets: number;
  revenueCents: number;
};

/**
 * The pace as points in time: `startsAt` less the days, kept to the chart's
 * window and held flat at both edges so it spans the same stretch as the
 * sales curve. Before the first point the average event had sold nothing.
 */
export function paceOnAxis(
  points: PacePoint[],
  startsAt: Date,
  from: Date,
  to: Date,
): PaceOnAxisPoint[] {
  if (points.length === 0) return [];
  const placed = points.map((point) => ({
    at: new Date(startsAt.getTime() - point.days * DAY_MS),
    tickets: point.tickets,
    revenueCents: point.revenueCents,
  }));
  const valueAt = (time: Date) => {
    let value = { tickets: 0, revenueCents: 0 };
    for (const point of placed) {
      if (point.at > time) break;
      value = point;
    }
    return { tickets: value.tickets, revenueCents: value.revenueCents };
  };
  return [
    { at: from, ...valueAt(from) },
    ...placed.filter((point) => point.at > from && point.at < to),
    { at: to, ...valueAt(to) },
  ];
}
