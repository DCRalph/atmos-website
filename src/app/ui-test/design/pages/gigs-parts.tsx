"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, ArrowUpRight, CalendarX2, Check } from "lucide-react";
import { cn } from "~/lib/utils";
import { useBoard } from "../board-state";
import { Button, Media, useCountdown } from "../primitives";
import {
  adminOnlyUpcoming,
  affiliatedList,
  ctaLabel,
  isTba,
  offSiteNotice,
  pastList,
  upcomingList,
  type Gig,
} from "./gigs-data";

export const gigTabs = [
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "affiliated", label: "Past affiliated" },
] as const;
export type GigTab = (typeof gigTabs)[number]["id"];

/** Board states shared by every gigs-list draft. */
export const gigsListStates = [
  {
    id: "upcoming",
    label: "Upcoming",
    hint: "Mixed ticket states: on sale, sold out, free with approval, external, TBA.",
  },
  { id: "past", label: "Past" },
  { id: "affiliated", label: "Past affiliated" },
  {
    id: "admin",
    label: "Admin view",
    hint: "An admin also sees drafts and affiliated gigs not yet public, flagged.",
  },
  { id: "loading", label: "Loading" },
  { id: "empty", label: "Nothing upcoming" },
  {
    id: "error",
    label: "Error",
    hint: "Proposed: the real page has no error state yet.",
  },
] as const;

type Phase = "ready" | "loading" | "error";

/** Server order for the upcoming list: soonest first, unannounced gigs last. */
const byDateTbaLast = (gigs: Gig[]) =>
  [...gigs].sort(
    (a, b) =>
      Number(isTba(a)) - Number(isTba(b)) ||
      a.start.getTime() - b.start.getTime(),
  );

/**
 * Tab + fetch state for a gigs-list draft, seeded from the board state.
 * "Try again" on the error state really re-runs a (mock) load.
 */
export function useGigsList(state: string) {
  const initialTab: GigTab =
    state === "past" || state === "affiliated" ? state : "upcoming";
  const [tab, setTab] = useState<GigTab>(initialTab);
  const [phase, setPhase] = useState<Phase>(
    state === "loading" ? "loading" : state === "error" ? "error" : "ready",
  );
  const admin = state === "admin";
  const empty = state === "empty";

  const lists: Record<GigTab, Gig[]> = {
    upcoming: empty
      ? []
      : admin
        ? byDateTbaLast([...upcomingList, ...adminOnlyUpcoming])
        : upcomingList,
    past: pastList,
    affiliated: affiliatedList,
  };

  const retry = () => {
    setPhase("loading");
    setTimeout(() => setPhase("ready"), 1200);
  };

  return {
    tab,
    setTab,
    phase,
    retry,
    admin,
    gigs: lists[tab],
    counts: phase === "ready" ? lists : null,
  };
}

/** Underline tabs with exact counts (the real lists aren't paginated). */
export function GigTabsBar({
  tab,
  onChange,
  counts,
  className,
}: {
  tab: GigTab;
  onChange: (t: GigTab) => void;
  counts: Record<GigTab, Gig[]> | null;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label="Gigs"
      className={cn(
        "no-scrollbar flex gap-7 overflow-x-auto border-b border-white/10",
        className,
      )}
    >
      {gigTabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={tab === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "mx-label -mb-px flex shrink-0 items-baseline gap-2 border-b-2 pb-4 text-[11px] transition-colors md:text-[12px]",
            tab === t.id
              ? "border-[var(--mx-accent)] text-white"
              : "border-transparent text-white/50 hover:text-white",
          )}
        >
          {t.label}
          {counts ? (
            <span className="mx-num text-[10px] text-white/45">
              {counts[t.id].length}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/** Pill showing the gig's ticket situation, as `GigTicketCta` decides it. */
export function CtaPill({
  gig,
  size = "sm",
  className,
}: {
  gig: Gig;
  size?: "sm" | "md";
  className?: string;
}) {
  const { label, tone } = ctaLabel(gig);
  return (
    <span
      className={cn(
        "mx-label inline-flex shrink-0 items-center gap-1 rounded-full transition-colors",
        size === "sm" ? "h-9 px-4 text-[10px]" : "h-11 px-5 text-[11px]",
        tone === "buy" &&
          "bg-white text-black group-hover:bg-[var(--mx-accent)] group-hover:text-[var(--mx-accent-ink)]",
        tone === "external" &&
          "border border-white/40 text-white group-hover:border-white",
        tone === "muted" && "border border-white/15 text-white/55",
        tone === "none" && "border border-white/25 text-white/80",
        className,
      )}
    >
      {label}
      {tone === "external" ? <ArrowUpRight className="size-3.5" /> : null}
    </span>
  );
}

/** The strip that tells an admin why the public can't see this gig. */
export function AdminStrip({
  gig,
  className,
}: {
  gig: Gig;
  className?: string;
}) {
  const notice = offSiteNotice(gig);
  if (!notice) return null;
  return (
    <p
      className={cn(
        "mx-label bg-[#ffcc4d] px-3 py-1.5 text-center text-[9px] text-black",
        className,
      )}
    >
      {notice}
    </p>
  );
}

/** TBA poster: the real poster, blurred, as a teaser. */
export function TbaPoster({
  gig,
  className,
  size = "text-5xl",
}: {
  gig: Gig;
  className?: string;
  size?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-white/5", className)}>
      <Media
        src={gig.poster}
        alt=""
        sizes="400px"
        className="absolute inset-0 scale-110 blur-2xl"
      />
      <div className="absolute inset-0 bg-black/30" />
      <p
        className={cn(
          "mx-display absolute inset-0 flex items-center justify-center",
          size,
        )}
      >
        TBA
      </p>
    </div>
  );
}

export function GigPoster({
  gig,
  className,
  sizes = "(min-width: 1024px) 33vw, 50vw",
  tbaSize,
}: {
  gig: Gig;
  className?: string;
  sizes?: string;
  tbaSize?: string;
}) {
  if (gig.mode === "TO_BE_ANNOUNCED")
    return <TbaPoster gig={gig} className={className} size={tbaSize} />;
  const soldOut =
    gig.tickets.kind === "onsite" &&
    (gig.tickets.event.status === "SOLD_OUT" ||
      gig.tickets.event.status === "CANCELLED");
  return (
    <Media
      src={gig.poster}
      alt={`${gig.title} poster`}
      sizes={sizes}
      className={cn(className, soldOut && "opacity-60 grayscale")}
    />
  );
}

/** Four glass tiles. Only used over imagery. */
export function CountdownTiles({
  target,
  compact,
}: {
  target: Date;
  compact?: boolean;
}) {
  const t = useCountdown(target);
  const cells = [
    ["Days", t?.days],
    ["Hrs", t?.hours],
    ["Min", t?.minutes],
    ["Sec", t?.seconds],
  ] as const;
  return (
    <div
      className={cn("grid grid-cols-4", compact ? "gap-1.5" : "gap-2")}
      role="timer"
      aria-label="Time until doors"
    >
      {cells.map(([label, value], i) => (
        <div
          key={label}
          className={cn(
            "mx-glass flex flex-col items-center justify-center rounded-xl",
            compact ? "h-16 min-w-14" : "h-24 min-w-20 md:min-w-24",
          )}
        >
          <span
            className={cn(
              "mx-display mx-num",
              compact ? "text-2xl" : "text-4xl",
              i === 0 && "text-[var(--mx-accent-text)]",
            )}
          >
            {value === undefined ? "--" : String(value).padStart(2, "0")}
          </span>
          <span
            className={cn(
              "mx-label text-white/65",
              compact ? "mt-1 text-[8px]" : "mt-2 text-[10px]",
            )}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Static skeleton blocks: shape of what's coming, no shimmer. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("bg-white/[0.06]", className)} />;
}

export function ErrorPanel({
  onRetry,
  title = "We couldn't load gigs",
  body = "Check your connection, then try again.",
}: {
  onRetry: () => void;
  title?: string;
  body?: string;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 border border-white/10 px-6 py-16 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full border border-[#ff6b6b]/50">
        <AlertTriangle className="size-5 text-[#ff8a8a]" />
      </span>
      <p className="mx-display text-2xl">{title}</p>
      <p className="max-w-[36ch] text-[14px] text-white/60">{body}</p>
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/** Empty upcoming list: turn the dead end into a signup and a way back. */
export function NothingUpcoming({
  onPast,
  children,
}: {
  onPast: () => void;
  children?: ReactNode;
}) {
  const { toast } = useBoard();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-col items-center gap-5 border border-white/10 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full border border-white/15">
        <CalendarX2 className="size-5 text-white/60" />
      </span>
      <p className="mx-display text-[clamp(1.75rem,4vw,2.5rem)]">
        No upcoming gigs
      </p>
      <p className="max-w-[40ch] text-[15px] text-white/60">
        We&apos;re booking the next one. Get told first, with presale codes
        before tickets go public.
      </p>
      {done ? (
        <p role="status" className="flex items-center gap-2 text-[15px]">
          <Check className="size-4 text-[var(--mx-accent-text)]" /> You&apos;re
          on the list.
        </p>
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
              return toast({
                title: "That email doesn't look right",
                tone: "error",
              });
            setDone(true);
            toast({ title: "You're on the list", tone: "success" });
          }}
          className="flex h-13 w-full max-w-[420px] items-center rounded-full border border-white/20 p-1.5 pl-5 focus-within:border-white/60"
        >
          <label htmlFor="gigs-empty-email" className="sr-only">
            Email
          </label>
          <input
            id="gigs-empty-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-white/45"
          />
          <Button type="submit" className="h-10">
            Notify me
          </Button>
        </form>
      )}
      <button
        type="button"
        onClick={onPast}
        className="mx-label text-[11px] text-white/65 underline-offset-4 hover:text-white hover:underline"
      >
        See past gigs
      </button>
      {children}
    </div>
  );
}

/** Groups gigs by a label, keeping input order (the server's order is meaningful). */
export function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups: { key: string; items: T[] }[] = [];
  for (const item of items) {
    const k = key(item);
    const last = groups.at(-1);
    if (last?.key === k) last.items.push(item);
    else groups.push({ key: k, items: [item] });
  }
  return groups;
}
