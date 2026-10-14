"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { cn } from "~/lib/utils";

/**
 * The live screen's building blocks. Everything here animates on change and
 * nothing loops: numbers roll, bars ease, a new feed row slides in with a
 * highlight that fades. A screen left on all night stays calm in between.
 */

export type Tone = "revenue" | "arrivals" | "warn" | "bad" | "plain";

const TONE_TEXT: Record<Tone, string> = {
  revenue: "text-[var(--ticket-series-revenue)]",
  arrivals: "text-[var(--ticket-series-arrivals)]",
  warn: "text-amber-400",
  bad: "text-red-400",
  plain: "",
};

const TONE_FILL: Record<Tone, string> = {
  revenue: "var(--ticket-series-revenue)",
  arrivals: "var(--ticket-series-arrivals)",
  warn: "var(--color-amber-400)",
  bad: "var(--color-red-400)",
  plain: "var(--foreground)",
};

export const toneText = (tone: Tone | undefined) => TONE_TEXT[tone ?? "plain"];

/** The current time, ticking every `everyMs`. */
export function useNow(everyMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

/** A box's rendered size, for a chart that fills whatever height it's given. */
export function useSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const ref = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height),
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

/** "now", "12s", "4m", "1h", "2d": a feed row's age at a glance. */
export function shortAgo(date: Date, now: Date) {
  const seconds = Math.max(
    0,
    Math.round((now.getTime() - date.getTime()) / 1000),
  );
  if (seconds < 5) return "now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/**
 * A number that rolls to each new value over `duration` ms, from zero on
 * first load. Formatting is the caller's, so money rolls as money.
 */
export function Count({
  value,
  format = (n) => String(Math.round(n)),
  duration = 600,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);

  useEffect(() => {
    const from = shownRef.current;
    const to = value;
    const still =
      from === to ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) {
      shownRef.current = to;
      setShown(to);
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(at) {
      const t = Math.min(1, (at - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (to - from) * eased;
      shownRef.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <span className={cn("tabular-nums", className)}>{format(shown)}</span>;
}

/** The uppercase label every block starts with. */
export function Label({
  children,
  meta,
  className,
}: {
  children: ReactNode;
  /** A quiet note on the right: a range, a count. */
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-muted-foreground flex min-w-0 items-baseline justify-between gap-3 text-[0.72rem] font-semibold tracking-[0.06em] uppercase",
        className,
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
      {meta ? (
        <span className="min-w-0 truncate font-normal tracking-normal normal-case">
          {meta}
        </span>
      ) : null}
    </p>
  );
}

/** A progress bar at the screen's scale, with an optional tick on it. */
export function Track({
  share,
  tone = "revenue",
  tick,
  className,
}: {
  /** 0 to 1. */
  share: number;
  tone?: Tone;
  /** 0 to 1, a mark to climb to, like break even. */
  tick?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-muted relative h-1.5 overflow-hidden rounded-full",
        className,
      )}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
        style={{
          width: `${Math.min(100, Math.max(0, share * 100))}%`,
          background: TONE_FILL[tone],
        }}
      />
      {tick !== undefined && tick > 0 && tick <= 1 ? (
        <div
          className="bg-foreground absolute inset-y-0 w-0.5"
          style={{ left: `${tick * 100}%` }}
        />
      ) : null}
    </div>
  );
}

/** One figure in the strip along the top. */
export function Cell({
  label,
  value,
  unit,
  sub,
  tone,
  track,
  index = 0,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  tone?: Tone;
  track?: { share: number; tick?: number; tone?: Tone };
  index?: number;
}) {
  return (
    <div
      className="live-rise min-w-0"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <Label>{label}</Label>
      <p
        className={cn(
          "mt-0.5 text-[1.75rem] leading-none font-bold tracking-tight tabular-nums lg:text-[2.1vw]",
          toneText(tone),
        )}
      >
        {value}
        {unit ? (
          <span className="text-muted-foreground ml-1 text-[0.55em] font-medium tracking-normal">
            {unit}
          </span>
        ) : null}
      </p>
      {track ? (
        <Track
          share={track.share}
          tick={track.tick}
          tone={track.tone ?? tone ?? "revenue"}
          className="mt-1.5"
        />
      ) : null}
      {sub ? (
        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs lg:text-[0.9vw] lg:leading-snug">
          {sub}
        </p>
      ) : null}
    </div>
  );
}

/** A bordered block: label on top, whatever it holds filling the rest. */
export function Card({
  title,
  meta,
  index = 0,
  className,
  children,
}: {
  title: string;
  meta?: ReactNode;
  index?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "live-rise bg-background/60 grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] gap-2 rounded-xl border p-3 lg:p-[1.1vw]",
        className,
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <Label meta={meta}>{title}</Label>
      {children}
    </section>
  );
}

/** Ranked rows: a name, a detail on the right, and a bar underneath. */
export function Ranks({
  rows,
  tone = "revenue",
  empty = "Nothing yet.",
}: {
  rows: {
    key: string;
    name: string;
    detail: string;
    share: number;
    tone?: Tone;
  }[];
  tone?: Tone;
  empty?: string;
}) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">{empty}</p>;
  }
  return (
    <div className="flex min-h-0 flex-col gap-2 overflow-hidden lg:gap-[0.6vw] lg:[mask-image:linear-gradient(to_bottom,#000_85%,transparent)]">
      {rows.map((row, i) => (
        <div
          key={row.key}
          className="live-rise grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-sm lg:text-[0.95vw]"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <span className="truncate">{row.name}</span>
          <span className="text-muted-foreground tabular-nums">
            {row.detail}
          </span>
          <Track
            share={row.share}
            tone={row.tone ?? tone}
            className="col-span-2"
          />
        </div>
      ))}
    </div>
  );
}

/** Label and value pairs, one per line, hairlines between. */
export function KeyValues({
  rows,
  className,
}: {
  rows: { key: string; label: string; value: ReactNode; tone?: Tone }[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "flex min-h-0 flex-col overflow-hidden text-sm lg:[mask-image:linear-gradient(to_bottom,#000_88%,transparent)] lg:text-[0.95vw]",
        className,
      )}
    >
      {rows.map((row) => (
        <div
          key={row.key}
          className="flex justify-between gap-3 border-t py-1 first:border-t-0 first:pt-0 lg:py-[0.35vw]"
        >
          <dt className="text-muted-foreground truncate">{row.label}</dt>
          <dd className={cn("shrink-0 tabular-nums", toneText(row.tone))}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export type FeedRow = {
  key: string;
  main: ReactNode;
  sub?: ReactNode;
  right: ReactNode;
  tone?: Tone;
};

/**
 * The newest things first. The first paint rises in, staggered; a row that
 * arrives later slides in with a highlight that fades. Shows as many rows
 * as fit and fades the rest.
 */
export function Feed({
  rows,
  empty = "Nothing yet.",
}: {
  rows: FeedRow[];
  empty?: string;
}) {
  // Rows mounting after the first paint has settled are arrivals.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), 800);
    return () => clearTimeout(timer);
  }, []);

  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">{empty}</p>;
  }
  return (
    <ul className="flex min-h-0 flex-col overflow-hidden lg:[mask-image:linear-gradient(to_bottom,#000_85%,transparent)]">
      {rows.map((row, i) => (
        <FeedItem key={row.key} row={row} index={i} late={settled} />
      ))}
    </ul>
  );
}

/** How a row appears is decided once, when it mounts, and never changes. */
function FeedItem({
  row,
  index,
  late,
}: {
  row: FeedRow;
  index: number;
  late: boolean;
}) {
  const [entry] = useState(() => (late ? "live-flash" : "live-rise"));
  return (
    <li
      className={cn(
        "-mx-2 flex items-baseline justify-between gap-3 rounded-md px-2 py-1 text-sm lg:py-[0.3vw] lg:text-[0.95vw]",
        entry,
      )}
      style={
        entry === "live-rise"
          ? { animationDelay: `${index * 40}ms` }
          : undefined
      }
    >
      <span className="min-w-0 truncate">
        <span className={cn("font-medium", toneText(row.tone))}>
          {row.main}
        </span>
        {row.sub ? (
          <span className="text-muted-foreground"> · {row.sub}</span>
        ) : null}
      </span>
      <span className="text-muted-foreground shrink-0 tabular-nums">
        {row.right}
      </span>
    </li>
  );
}

/** Steps in a row, each with a count and a bar against the first step. */
export function Flow({
  steps,
}: {
  steps: { key: string; label: string; value: number; tone?: Tone }[];
}) {
  const top = Math.max(1, steps[0]?.value ?? 0);
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
    >
      {steps.map((step, i) => (
        <div key={step.key} className="relative min-w-0">
          {i > 0 ? (
            <span
              className="text-muted-foreground/60 absolute top-0 -left-2 text-lg leading-none lg:text-[1.3vw]"
              aria-hidden
            >
              ›
            </span>
          ) : null}
          <p
            className={cn(
              "text-2xl leading-none font-bold tracking-tight lg:text-[2vw]",
              toneText(step.tone),
            )}
          >
            <Count value={step.value} />
          </p>
          <p className="text-muted-foreground mt-1 truncate text-xs lg:text-[0.85vw]">
            {step.label}
          </p>
          <Track
            share={Math.min(1, step.value / top)}
            tone={step.tone ?? "revenue"}
            className="mt-1.5"
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Bars that fill their box, for arrivals by the five minutes. Each bar's
 * height eases to its new value; the first paint grows them in. The last bar
 * can be marked as the one still being counted.
 */
export function Bars({
  values,
  tone = "arrivals",
  markLast = false,
  className,
}: {
  values: number[];
  tone?: Tone;
  markLast?: boolean;
  className?: string;
}) {
  const max = Math.max(1, ...values);
  return (
    <div className={cn("flex h-full min-h-0 items-end gap-px", className)}>
      {values.map((value, i) => {
        const last = markLast && i === values.length - 1;
        const style: CSSProperties = {
          // The bar still being counted always shows, even before anyone's in it.
          height: `${Math.max(value > 0 || last ? 2 : 0, (value / max) * 100)}%`,
          background: last ? "var(--foreground)" : TONE_FILL[tone],
          animationDelay: `${i * 20}ms`,
        };
        return (
          <div
            key={i}
            className="live-grow flex-1 rounded-t-[2px] opacity-90 transition-[height] duration-700 ease-out"
            style={style}
          />
        );
      })}
    </div>
  );
}

/** A grid of placeholder blocks while the first answer loads. */
export function Loading() {
  return (
    <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-3 lg:gap-4">
      <div className="bg-muted/30 h-20 rounded-xl" />
      <div className="bg-muted/30 rounded-xl" />
      <div className="bg-muted/30 rounded-xl" />
    </div>
  );
}
