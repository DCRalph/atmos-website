"use client";

import { api, type RouterOutputs } from "~/trpc/react";
import { gigOffSiteNotice } from "~/lib/gig-visibility";
import { nightEnd as sharedNightEnd, nightOf, useMinuteClock } from "../on-now";

export type TodayGig =
  | RouterOutputs["gigs"]["getToday"][number]
  | RouterOutputs["gigs"]["getUpcoming"][number];
export type LivePhase = "tonight" | "on" | "wrap";

const HOUR = 3_600_000;
/** "Tonight" only once doors are this close; earlier it's just the next gig. */
const TONIGHT_LEAD = 12 * HOUR;
/** How long "That's a wrap" stays up after close. */
const WRAP_FOR = 6 * HOUR;

/** When a gig's night ends: its end time, or a default length after start. */
export const nightEnd = (gig: Pick<TodayGig, "gigStartTime" | "gigEndTime">) =>
  sharedNightEnd(nightOf(gig));

function phaseOf(gig: TodayGig, now: number): LivePhase | null {
  const start = gig.gigStartTime.getTime();
  const end = nightEnd(gig).getTime();
  if (now < start) return start - now <= TONIGHT_LEAD ? "tonight" : null;
  if (now < end) return "on";
  if (now < end + WRAP_FOR) return "wrap";
  return null;
}

const priority: Record<LivePhase, number> = { on: 0, tonight: 1, wrap: 2 };

/**
 * The gig the home page should treat as live, and which part of its night
 * it's in, by the gig's own start and end times. Unannounced gigs and ones
 * the public can't see never go live.
 *
 * Candidates come from two lists. `gigs.getUpcoming` has every gig that
 * hasn't finished, which covers tonight and on now however long the night
 * runs. `gigs.getToday` adds the just-finished ones for the wrap. It can't be
 * the only source: its window is keyed to the start date in UTC and closes at
 * 5am UTC the next day (about 6pm in New Zealand), so it drops a gig that's still
 * going that evening.
 */
export function useLiveGig() {
  // Refetching keeps the phase honest if someone leaves the page open all night.
  const upcoming = api.gigs.getUpcoming.useQuery(undefined, {
    refetchInterval: 5 * 60_000,
  });
  const today = api.gigs.getToday.useQuery(undefined, {
    refetchInterval: 5 * 60_000,
  });
  const now = useMinuteClock();
  if (now === null || (!upcoming.data && !today.data)) return null;

  const byId = new Map<string, TodayGig>();
  for (const g of [...(upcoming.data ?? []), ...(today.data ?? [])]) {
    byId.set(g.id, g);
  }

  const live = [...byId.values()]
    .filter((g) => !g.isTba && gigOffSiteNotice(g) === null)
    .flatMap((gig) => {
      const phase = phaseOf(gig, now);
      return phase ? [{ gig, phase }] : [];
    })
    .sort((a, b) => priority[a.phase] - priority[b.phase]);

  const first = live[0];
  return first ? { ...first, now } : null;
}
