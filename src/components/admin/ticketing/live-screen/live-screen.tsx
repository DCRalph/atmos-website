"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Maximize2, Minimize2 } from "lucide-react";

import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import {
  formatEventDate,
  formatEventTime,
  formatTimeAgo,
} from "~/lib/ticketing/dates";
import { DoorsMode } from "./doors-mode";
import { SalesMode } from "./sales-mode";
import { useNow } from "./parts";

/**
 * The event's live screen, made to be left up on a TV: a Sales mode for
 * watching tickets go and a Doors mode for watching the room fill. The mode
 * defaults to Sales before doors open and Doors afterwards. An explicit mode
 * is in the address so a bookmark opens straight into it; the pills, or the
 * keys S and D, switch. F toggles the browser's fullscreen. On desktop the
 * whole thing fits the viewport with no scrolling; on a phone it stacks and
 * scrolls.
 */
export type LiveMode = "sales" | "doors";

const MODES: { value: LiveMode; label: string }[] = [
  { value: "sales", label: "Sales" },
  { value: "doors", label: "Doors" },
];

const STALE_MS = 60_000;

export type LiveEvent = {
  name: string;
  startsAt: Date;
  doorsAt: Date | null;
  venueName: string | null;
  timezone: string;
  salesOpenAt: Date | null;
  publishedAt: Date | null;
};

export function LiveScreen({
  eventId,
  backHref,
}: {
  eventId: string;
  backHref: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const setMode = useCallback(
    (next: LiveMode) => router.replace(`${pathname}?mode=${next}`),
    [router, pathname],
  );

  const event = api.ticketEvents.byId.useQuery({ id: eventId });
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const now = useNow(1000);
  const requestedMode = params.get("mode");
  const doorsAt = event.data?.doorsAt ?? event.data?.startsAt;
  const mode: LiveMode =
    requestedMode === "sales" || requestedMode === "doors"
      ? requestedMode
      : doorsAt && now.getTime() >= doorsAt.getTime()
        ? "doors"
        : "sales";
  const [fullscreen, setFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (
        e.target instanceof HTMLElement &&
        e.target.closest("input, textarea")
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "s") setMode("sales");
      if (key === "d") setMode("doors");
      if (key === "f") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setMode, toggleFullscreen]);

  const timezone = event.data?.timezone ?? "Pacific/Auckland";

  return (
    <LiveShell
      event={event.data ?? null}
      mode={mode}
      onMode={setMode}
      now={now}
      updatedAt={updatedAt}
      backHref={backHref}
      fullscreen={fullscreen}
      onFullscreen={toggleFullscreen}
    >
      {mode === "sales" ? (
        <SalesMode
          eventId={eventId}
          timezone={timezone}
          onUpdated={setUpdatedAt}
        />
      ) : (
        <DoorsMode
          eventId={eventId}
          timezone={timezone}
          doorsAt={event.data?.doorsAt ?? event.data?.startsAt ?? null}
          onUpdated={setUpdatedAt}
        />
      )}
    </LiveShell>
  );
}

/** The frame around either mode: the header, and the viewport-filling grid. */
export function LiveShell({
  event,
  mode,
  onMode,
  now,
  updatedAt,
  backHref,
  fullscreen,
  onFullscreen,
  children,
}: {
  event: LiveEvent | null;
  mode: LiveMode;
  onMode: (mode: LiveMode) => void;
  now: Date;
  updatedAt: Date | null;
  backHref: string;
  fullscreen: boolean;
  onFullscreen: () => void;
  children: ReactNode;
}) {
  const timezone = event?.timezone ?? "Pacific/Auckland";
  const ageMs = updatedAt ? now.getTime() - updatedAt.getTime() : null;
  const stale = ageMs !== null && ageMs > STALE_MS;

  return (
    <div className="flex min-h-dvh flex-col gap-3 p-4 lg:h-dvh lg:gap-[1vw] lg:overflow-hidden lg:p-[1.4vw]">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl leading-tight font-bold tracking-tight lg:text-[1.5vw]">
            <Link
              href={backHref}
              className="text-muted-foreground hover:text-foreground shrink-0"
              aria-label="Back to the event"
            >
              <ArrowLeft className="size-4 lg:size-[1.2vw]" aria-hidden />
            </Link>
            <span className="truncate">{event?.name ?? "Live"}</span>
          </h1>
          <p className="text-muted-foreground truncate text-xs lg:text-[0.9vw]">
            {event ? <Meta event={event} mode={mode} now={now} /> : null}
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Mode"
          className="flex gap-0.5 rounded-full border p-0.5"
        >
          {MODES.map((option) => (
            <button
              key={option.value}
              role="tab"
              type="button"
              aria-selected={mode === option.value}
              onClick={() => onMode(option.value)}
              className={cn(
                "rounded-full px-3 py-1 text-sm font-semibold transition-colors lg:px-[1.1vw] lg:py-[0.35vw] lg:text-[0.95vw]",
                mode === option.value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-right">
          <div>
            <p className="text-xl leading-tight font-semibold tabular-nums lg:text-[1.5vw]">
              {formatEventTime(now, timezone)}
            </p>
            <p className="text-muted-foreground flex items-center justify-end gap-1.5 text-xs lg:text-[0.85vw]">
              <span
                key={updatedAt?.getTime() ?? 0}
                className={cn(
                  "live-blink inline-block size-2 rounded-full lg:size-[0.6vw]",
                  stale ? "bg-amber-400" : "bg-[var(--ticket-series-arrivals)]",
                )}
              />
              {ageMs === null || !updatedAt
                ? "loading"
                : stale
                  ? `numbers are ${formatTimeAgo(updatedAt, now).replace(" ago", "")} old`
                  : `updated ${Math.max(0, Math.round(ageMs / 1000))}s ago`}
            </p>
          </div>
          <button
            type="button"
            onClick={onFullscreen}
            className="text-muted-foreground hover:text-foreground rounded-md border p-1.5 lg:p-[0.45vw]"
            aria-label={fullscreen ? "Leave fullscreen" : "Fullscreen"}
          >
            {fullscreen ? (
              <Minimize2 className="size-4 lg:size-[1vw]" aria-hidden />
            ) : (
              <Maximize2 className="size-4 lg:size-[1vw]" aria-hidden />
            )}
          </button>
        </div>
      </header>

      {children}
    </div>
  );
}

/** The line under the name: when and where, and how far into the night. */
function Meta({
  event,
  mode,
  now,
}: {
  event: LiveEvent;
  mode: LiveMode;
  now: Date;
}) {
  const doors = event.doorsAt ?? event.startsAt;
  const parts = [
    formatEventDate(event.startsAt, event.timezone),
    event.venueName,
  ].filter(Boolean);
  if (mode === "doors" && doors.getTime() <= now.getTime()) {
    parts.push(
      `doors opened ${formatTimeAgo(doors, now).replace(" ago", "")} ago`,
    );
  } else {
    parts.push(`doors ${formatEventTime(doors, event.timezone)}`);
    const onSale = event.salesOpenAt ?? event.publishedAt;
    if (onSale && onSale.getTime() < now.getTime()) {
      const days = Math.floor(
        (now.getTime() - onSale.getTime()) / (24 * 60 * 60 * 1000),
      );
      parts.push(`on sale ${days} ${days === 1 ? "day" : "days"}`);
    }
  }
  return <>{parts.join(" · ")}</>;
}
