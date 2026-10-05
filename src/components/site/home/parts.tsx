"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "~/lib/utils";
import { DEFAULT_EVENT_TIMEZONE } from "~/lib/ticketing/dates";
import { AtmosLogo, Button, Media, buttonVariants } from "../ui";

// Gig dates render in the venue's zone, never the viewer's.
const nz = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-NZ", {
    ...options,
    timeZone: DEFAULT_EVENT_TIMEZONE,
  });

export const nzDate = {
  /** `Oct` */
  shortMonth: nz({ month: "short" }),
  /** `October` */
  month: nz({ month: "long" }),
  /** `2026` */
  year: nz({ year: "numeric" }),
  /** `09` */
  day: nz({ day: "2-digit" }),
  /** `Fri` */
  weekday: nz({ weekday: "short" }),
  /** `25 Sept 2026` */
  full: nz({ day: "numeric", month: "short", year: "numeric" }),
};

/**
 * Month tab heading a month of listings: accent month over the year. With no
 * month it's the dashed TBA tab.
 */
export function MonthBadge({ month, year }: { month?: string; year?: string }) {
  if (!month) {
    return (
      <span className="t-label flex h-[52px] w-14 items-center justify-center rounded-[var(--site-r-chip)] border border-dashed border-white/30 text-[10px] text-white/70">
        TBA
      </span>
    );
  }
  return (
    <span className="flex w-14 flex-col overflow-hidden rounded-[var(--site-r-chip)] text-center">
      <span className="t-label bg-[var(--site-accent)] py-1.5 text-[10px] text-[var(--site-accent-ink)]">
        {month}
      </span>
      <span className="t-label bg-white/10 py-1.5 text-[10px] text-white/80 tabular-nums">
        {year}
      </span>
    </span>
  );
}

/** The fields a poster needs. Past gigs from the home router may lack `posterFileUpload`. */
type PosterGig = {
  title: string;
  isTba: boolean;
  posterFileUpload?: { url: string } | null;
  media?: { url: string | null }[];
};

/**
 * Gig poster, hard-edged. Falls back to the first legacy photo, then a quiet
 * logo block. TBA gigs show their poster blurred behind "TBA".
 */
export function GigPoster({
  gig,
  className,
  sizes,
  tbaClassName = "text-sm",
}: {
  gig: PosterGig;
  className?: string;
  sizes: string;
  tbaClassName?: string;
}) {
  const src =
    gig.posterFileUpload?.url ?? gig.media?.find((m) => m.url)?.url ?? null;

  if (gig.isTba) {
    return (
      <div className={cn("relative overflow-hidden bg-white/5", className)}>
        {src ? (
          <Media
            src={src}
            alt=""
            sizes={sizes}
            className="absolute inset-0 scale-110 blur-xl"
          />
        ) : null}
        <div className="absolute inset-0 bg-black/40" />
        <p
          className={cn(
            "t-display absolute inset-0 flex items-center justify-center",
            tbaClassName,
          )}
        >
          TBA
        </p>
      </div>
    );
  }

  if (!src) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-white/[0.06] p-[15%]",
          className,
        )}
      >
        <AtmosLogo className="w-full opacity-25" />
      </div>
    );
  }

  return (
    <Media
      src={src}
      alt={`${gig.title} poster`}
      sizes={sizes}
      className={className}
    />
  );
}

/** Home section heading with a link to the full page. */
export function SectionHeader({
  id,
  title,
  href,
  linkLabel,
  children,
}: {
  /** Put on the heading so the section can be labelled by it. */
  id: string;
  title: string;
  href: string;
  linkLabel: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-10">
      <h2 id={id} className="t-heading text-[clamp(1.75rem,4.5vw,3.5rem)]">
        {title}
      </h2>
      <div className="flex items-center gap-2">
        {children}
        <Link
          href={href}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {linkLabel} <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

/** Inline failure for a home section, with a retry. */
export function SectionError({
  what,
  onRetry,
}: {
  what: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-4 border-y border-white/10 py-6"
    >
      <p className="text-[15px] text-white/70">Couldn&apos;t load {what}.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/** A section with nothing in it yet. */
export function SectionEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="border-y border-white/10 py-6 text-[15px] text-white/60">
      {children}
    </p>
  );
}
