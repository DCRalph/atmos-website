"use client";

import { useSyncExternalStore } from "react";
import { cn } from "~/lib/utils";
import { formatEventTime } from "~/lib/ticketing/dates";
import { CountdownTiles } from "./ui";

/**
 * "On now" across the site. One rule (doors to close, by the gig's own
 * times) and one look (solid accent), so a gig that's running reads the same
 * wherever it appears. Countdowns hand over to it at doors.
 */

/** A gig or ticket event's night: when it starts and, if known, ends. */
export type Night = { start: Date; end?: Date | null };

const HOUR = 3_600_000;
/** Length assumed for a night with no end time. */
export const DEFAULT_NIGHT_LENGTH = 6 * HOUR;

export const nightOf = (gig: {
  gigStartTime: Date;
  gigEndTime?: Date | null;
}): Night => ({
  start: gig.gigStartTime,
  end: gig.gigEndTime,
});

/** When the night ends: its end time, or a default length after start. */
export const nightEnd = (night: Night) =>
  night.end ?? new Date(night.start.getTime() + DEFAULT_NIGHT_LENGTH);

export type NightPhase = "before" | "on" | "after";

export const nightPhase = (night: Night, now: number): NightPhase =>
  now < night.start.getTime()
    ? "before"
    : now < nightEnd(night).getTime()
      ? "on"
      : "after";

const subscribeHalfMinutes = (tick: () => void) => {
  const id = setInterval(tick, 30_000);
  return () => clearInterval(id);
};

/**
 * Now, to the minute. Null on the server and during hydration, so anything
 * time-dependent renders the same as the server first, then settles.
 */
export const useMinuteClock = () =>
  useSyncExternalStore(
    subscribeHalfMinutes,
    () => Math.floor(Date.now() / 60_000) * 60_000,
    () => null,
  );

/** Whether a night is running right now (false until the clock is known). */
export function useIsOnNow(night: Night | null) {
  const now = useMinuteClock();
  return night !== null && now !== null && nightPhase(night, now) === "on";
}

/** Small solid chip for rows and cards. The dot is solid: nothing loops. */
export function OnNowChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "t-label inline-flex h-7 w-fit shrink-0 items-center gap-1.5 rounded-full bg-[var(--site-accent)] px-3 text-[10px] text-[var(--site-accent-ink)]",
        className,
      )}
    >
      <span
        className="size-1.5 rounded-full bg-[var(--site-accent-ink)]"
        aria-hidden
      />
      On now
    </span>
  );
}

/**
 * The block that replaces a countdown once doors open: "On now", when it
 * closes, and how far through the night it is. Sized like the tiles it
 * replaces so layouts don't jump at doors.
 */
export function OnNowPanel({
  night,
  now,
  compact,
}: {
  night: Night;
  now: number;
  compact?: boolean;
}) {
  const end = nightEnd(night);
  const span = end.getTime() - night.start.getTime();
  const pct = Math.min(
    100,
    Math.max(0, ((now - night.start.getTime()) / span) * 100),
  );
  return (
    <div
      className={cn(
        "flex flex-col justify-center rounded-xl bg-[var(--site-accent)] text-[var(--site-accent-ink)]",
        compact
          ? "h-16 w-[248px] gap-1.5 px-4"
          : "h-24 w-[min(100%,344px)] gap-2.5 px-5 md:w-[392px]",
      )}
    >
      <div className="flex items-baseline justify-between gap-4">
        <span
          className={cn(
            "t-display flex items-center gap-2",
            compact ? "text-xl" : "text-3xl",
          )}
        >
          <span
            className={cn(
              "rounded-full bg-[var(--site-accent-ink)]",
              compact ? "size-2" : "size-2.5",
            )}
            aria-hidden
          />
          On now
        </span>
        <span className="t-label text-[10px]">
          {night.end
            ? `Till ${formatEventTime(end)}`
            : `Doors ${formatEventTime(night.start)}`}
        </span>
      </div>
      {night.end ? (
        <div
          role="progressbar"
          aria-label="How far through the night"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="relative h-1.5 overflow-hidden rounded-full bg-black/20"
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[var(--site-accent-ink)] transition-[width] duration-1000"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Countdown to doors, then "On now" until close, then nothing. Use wherever
 * a gig shows a countdown.
 */
export function GigCountdown({
  night,
  compact,
}: {
  night: Night;
  compact?: boolean;
}) {
  const now = useMinuteClock();
  const phase = now === null ? "before" : nightPhase(night, now);
  if (phase === "after") return null;
  if (phase === "on" && now !== null)
    return <OnNowPanel night={night} now={now} compact={compact} />;
  return <CountdownTiles target={night.start} compact={compact} />;
}
