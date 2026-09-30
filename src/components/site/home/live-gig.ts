"use client";

import { useSyncExternalStore } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { gigOffSiteNotice } from "~/lib/gig-visibility";

export type TodayGig = RouterOutputs["gigs"]["getToday"][number];
export type LivePhase = "tonight" | "on" | "wrap";

const HOUR = 3_600_000;
/** "Tonight" only once doors are this close; earlier it's just the next gig. */
const TONIGHT_LEAD = 12 * HOUR;
/** Length assumed for a gig with no end time, for its "on now" window. */
const DEFAULT_LENGTH = 6 * HOUR;
/** How long "That's a wrap" stays up after close. */
const WRAP_FOR = 6 * HOUR;

const subscribeHalfMinutes = (tick: () => void) => {
  const id = setInterval(tick, 30_000);
  return () => clearInterval(id);
};

/**
 * Now, to the minute; null on the server and during hydration so the live
 * state never disagrees with the server render.
 */
export const useMinuteClock = () =>
  useSyncExternalStore(
    subscribeHalfMinutes,
    () => Math.floor(Date.now() / 60_000) * 60_000,
    () => null,
  );

/** When a gig's night ends: its end time, or a default length after start. */
export const nightEnd = (gig: Pick<TodayGig, "gigStartTime" | "gigEndTime">) =>
  gig.gigEndTime ?? new Date(gig.gigStartTime.getTime() + DEFAULT_LENGTH);

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
 * it's in. `gigs.getToday` gives candidates (the day before until 5am after);
 * this narrows that to tonight, on now, or just finished, by the gig's own
 * times. Unannounced gigs and ones the public can't see never go live.
 */
export function useLiveGig() {
  const today = api.gigs.getToday.useQuery(undefined, {
    // Keeps the phase honest if someone leaves the page open all night.
    refetchInterval: 5 * 60_000,
  });
  const now = useMinuteClock();
  if (now === null || !today.data) return null;

  const live = today.data
    .filter((g) => g.mode !== "TO_BE_ANNOUNCED" && gigOffSiteNotice(g) === null)
    .flatMap((gig) => {
      const phase = phaseOf(gig, now);
      return phase ? [{ gig, phase }] : [];
    })
    .sort((a, b) => priority[a.phase] - priority[b.phase]);

  const first = live[0];
  return first ? { ...first, now } : null;
}
