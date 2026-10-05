"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "~/lib/utils";
import { gigOffSiteNotice } from "~/lib/gig-visibility";
import { gigPath } from "~/lib/gig-url";
import { DEFAULT_EVENT_TIMEZONE } from "~/lib/ticketing/dates";
import { formatNZDCompact } from "~/lib/ticketing/money";
import type { RouterOutputs } from "~/trpc/react";
import { Media } from "../ui";

export type ListGig = RouterOutputs["gigs"]["getUpcoming"][number];
export type DetailGig = NonNullable<RouterOutputs["gigs"]["getById"]>;
export type PublicTicketEvent =
  RouterOutputs["ticketEvents"]["upcoming"][number];
type GigLike = Pick<
  ListGig,
  | "id"
  | "title"
  | "isTba"
  | "isAffiliated"
  | "status"
  | "gigStartTime"
  | "gigEndTime"
  | "posterFileUpload"
>;

// ---------------------------------------------------------------------------
// Dates, always in NZ time (gigs have no timezone of their own).

const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-NZ", {
    ...opts,
    timeZone: DEFAULT_EVENT_TIMEZONE,
  });
const dayF = fmt({ weekday: "short", day: "2-digit", month: "short" });
const longF = fmt({
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timeF = fmt({ hour: "numeric", minute: "2-digit", hour12: true });
const monthF = fmt({ month: "long", year: "numeric" });
const dayNumF = fmt({ day: "2-digit" });
const weekdayF = fmt({ weekday: "short" });
const shortMonthF = fmt({ month: "short" });
const yearF = fmt({ year: "numeric" });

/** `Fri 09 Oct` */
export const fmtDay = (d: Date) => dayF.format(d).replace(",", "");
/** `Friday 9 October 2026` */
export const fmtLong = (d: Date) => longF.format(d).replace(",", "");
/** `9:00pm` */
export const fmtTime = (d: Date) =>
  timeF.format(d).replace(/\s/g, "").toLowerCase();
/** `October 2026`, used as a grouping key. */
export const fmtMonth = (d: Date) => monthF.format(d);
export const fmtDayNum = (d: Date) => dayNumF.format(d);
export const fmtWeekday = (d: Date) => weekdayF.format(d);
export const fmtShortMonth = (d: Date) => shortMonthF.format(d);
export const fmtYear = (d: Date) => yearF.format(d);

export const isTba = (gig: Pick<ListGig, "isTba">) => gig.isTba;

/** Finished, by end time when there is one (mirrors `isGigPast`). */
export const isPast = (
  gig: Pick<ListGig, "isTba" | "gigStartTime" | "gigEndTime">,
  now = Date.now(),
) => !isTba(gig) && (gig.gigEndTime ?? gig.gigStartTime).getTime() < now;

/** The display title: a TBA gig's real name is a secret. */
export const gigTitle = (gig: Pick<ListGig, "isTba" | "title">) =>
  isTba(gig) ? "TBA" : gig.title;

/** Groups items by a key, keeping input order (the server's order is meaningful). */
export function groupConsecutive<T>(
  items: readonly T[],
  key: (item: T) => string,
) {
  const groups: { key: string; items: T[] }[] = [];
  for (const item of items) {
    const k = key(item);
    const last = groups.at(-1);
    if (last?.key === k) last.items.push(item);
    else groups.push({ key: k, items: [item] });
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Tickets

export type TicketCta = {
  label: string;
  tone: "buy" | "muted" | "external" | "none";
  href: string | null;
};

/**
 * The ticket call to action for a gig, following `GigTicketCta`: a linked
 * ticket event wins, the legacy `ticketLink` is the fallback.
 */
export function ticketCta(
  gig: Pick<ListGig, "id" | "title" | "isTba" | "ticketLink">,
  event: PublicTicketEvent | undefined,
): TicketCta {
  if (isTba(gig)) return { label: "Details", tone: "none", href: null };
  if (event) {
    if (event.status === "CANCELLED")
      return { label: "Cancelled", tone: "muted", href: null };
    if (event.status === "SOLD_OUT")
      return { label: "Sold out", tone: "muted", href: null };
    if (!event.onSale)
      return { label: "Not on sale yet", tone: "muted", href: null };
    return {
      label:
        event.fromPriceCents === 0
          ? "Free tickets"
          : `Tickets from ${formatNZDCompact(event.fromPriceCents ?? 0)}`,
      tone: "buy",
      href: `${gigPath(gig)}#tickets`,
    };
  }
  if (gig.ticketLink)
    return { label: "Get tickets", tone: "external", href: gig.ticketLink };
  return { label: "Details", tone: "none", href: null };
}

/** The pill that shows a `TicketCta`. Presentational; the parent row is the link. */
export function CtaPill({
  cta,
  size = "sm",
  className,
}: {
  cta: TicketCta;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "t-label inline-flex shrink-0 items-center gap-1 rounded-full whitespace-nowrap transition-colors",
        size === "sm" ? "h-9 px-4 text-[10px]" : "h-11 px-5 text-[11px]",
        cta.tone === "buy" &&
          "bg-white text-black group-hover:bg-[var(--site-accent)] group-hover:text-[var(--site-accent-ink)]",
        cta.tone === "external" &&
          "border border-white/40 text-white group-hover:border-white",
        cta.tone === "muted" && "border border-white/15 text-white/55",
        cta.tone === "none" && "border border-white/25 text-white/80",
        className,
      )}
    >
      {cta.label}
      {cta.tone === "external" ? <ArrowUpRight className="size-3.5" /> : null}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Visuals

/** An unannounced gig's poster, blurred as a teaser. */
export function TbaPoster({
  src,
  className,
  size = "text-5xl",
}: {
  src: string | null;
  className?: string;
  size?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-white/5", className)}>
      {src ? (
        <Media
          src={src}
          alt=""
          sizes="400px"
          className="absolute inset-0 scale-110 blur-2xl"
        />
      ) : null}
      <div className="absolute inset-0 bg-black/30" />
      <p
        className={cn(
          "t-display absolute inset-0 flex items-center justify-center",
          size,
        )}
      >
        TBA
      </p>
    </div>
  );
}

/** Poster with TBA and missing-poster fallbacks; greyed when `muted` (sold out, cancelled). */
export function GigPoster({
  gig,
  className,
  sizes = "(min-width: 1024px) 33vw, 50vw",
  tbaSize,
  muted,
  priority,
}: {
  gig: GigLike;
  className?: string;
  sizes?: string;
  tbaSize?: string;
  muted?: boolean;
  priority?: boolean;
}) {
  const src = gig.posterFileUpload?.url ?? null;
  if (isTba(gig))
    return <TbaPoster src={src} className={className} size={tbaSize} />;
  if (!src) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-white/[0.06]",
          className,
        )}
      >
        <span className="t-label text-[9px] text-white/40">No poster</span>
      </div>
    );
  }
  return (
    <Media
      src={src}
      alt={`${gig.title} poster`}
      sizes={sizes}
      priority={priority}
      className={cn(className, muted && "opacity-60 grayscale")}
    />
  );
}

/** Month over year; the top half carries the accent. */
export function DateChip({ date }: { date: Date }) {
  return (
    <span className="flex w-14 flex-col overflow-hidden rounded-[var(--site-r-chip)] text-center">
      <span className="t-label bg-[var(--site-accent)] py-1 text-[10px] text-[var(--site-accent-ink)]">
        {fmtShortMonth(date)}
      </span>
      <span className="t-label bg-white/10 py-1 text-[10px] text-white/80 tabular-nums">
        {fmtYear(date)}
      </span>
    </span>
  );
}

/** Why an admin can see a gig the public can't. Renders nothing otherwise. */
export function AdminStrip({
  gig,
  className,
}: {
  gig: Pick<
    ListGig,
    "status" | "isTba" | "isAffiliated" | "gigStartTime" | "gigEndTime"
  >;
  className?: string;
}) {
  const notice = gigOffSiteNotice(gig);
  if (!notice) return null;
  return (
    <p
      className={cn(
        "t-label bg-[var(--site-warn)] px-3 py-1.5 text-center text-[9px] text-black",
        className,
      )}
    >
      {notice}
    </p>
  );
}

/** Link wrapper for a row/card: internal gig page or the row's own href. */
export function GigLink({
  gig,
  className,
  children,
  onMouseEnter,
}: {
  gig: Pick<ListGig, "id" | "title" | "isTba">;
  className?: string;
  children: ReactNode;
  onMouseEnter?: () => void;
}) {
  return (
    <Link href={gigPath(gig)} className={className} onMouseEnter={onMouseEnter}>
      {children}
    </Link>
  );
}
