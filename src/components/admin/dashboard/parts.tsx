import type { ReactNode } from "react";
import type { RouterOutputs } from "~/trpc/react";
import { cn } from "~/lib/utils";

export type Overview = RouterOutputs["dashboard"]["overview"];

/**
 * A bordered column of the dashboard: a title bar, then a body that scrolls on
 * its own on desktop. On a phone the page scrolls instead, so the body just
 * grows.
 */
export function Panel({
  title,
  aside,
  above,
  className,
  children,
}: {
  title: ReactNode;
  aside?: ReactNode;
  /** Pinned under the title bar, outside the scrolling body. */
  above?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex min-h-0 min-w-0 flex-col rounded-lg border",
        className,
      )}
    >
      <div className="flex min-h-11 shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3.5 py-1.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {aside}
      </div>
      {above}
      <div className="min-h-0 flex-1 px-3.5 pb-3.5 lg:overflow-y-auto">
        {children}
      </div>
    </section>
  );
}

/** A small uppercase heading inside a panel, with a count or date beside it. */
export function GroupHeading({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <h3 className="text-muted-foreground mt-4 mb-0.5 flex items-baseline gap-2 text-xs font-semibold tracking-wide uppercase first:mt-3">
      {children}
      {aside !== undefined ? (
        <span className="font-normal tracking-normal normal-case">{aside}</span>
      ) : null}
    </h3>
  );
}

/** A thin progress track in the admin accent. */
export function Bar({
  value,
  className,
}: {
  /** 0 to 1. */
  value: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "bg-muted block h-1.5 overflow-hidden rounded-full",
        className,
      )}
    >
      <span
        className="bg-admin-accent block h-full rounded-full"
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </span>
  );
}

/** `40 min`, `3h`, `2 days`: how far apart two moments are, roughly. */
export function formatGap(ms: number) {
  const minutes = Math.max(1, Math.round(Math.abs(ms) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)} days`;
}
