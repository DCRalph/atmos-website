"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ArrowRight, ArrowUpRight, Navigation, X } from "lucide-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { gigPath } from "~/lib/gig-url";
import { gigOffSiteNotice } from "~/lib/gig-visibility";
import { formatEventTime } from "~/lib/ticketing/dates";
import { formatNZDCompact } from "~/lib/ticketing/money";
import {
  AtmosLogo,
  CountdownTiles,
  Media,
  Skeleton,
  buttonVariants,
} from "../ui";
import {
  nightEnd,
  useLiveGig,
  type LivePhase,
  type TodayGig,
} from "./live-gig";
import { nzDate } from "./parts";
import { GigCountdown, nightOf } from "../on-now";

type UpcomingGig = RouterOutputs["gigs"]["getUpcoming"][number];
/** What the ticket pill needs from any gig shape. */
type CtaGig = Pick<UpcomingGig, "id" | "title" | "mode" | "ticketLink">;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const subscribeToMotionPref = (onChange: () => void) => {
  const query = matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/** False on the server and until hydrated, so the video never causes a mismatch. */
const useMotionAllowed = () =>
  useSyncExternalStore(
    subscribeToMotionPref,
    () => !matchMedia(REDUCED_MOTION).matches,
    () => false,
  );

/**
 * Home hero: the logo over the looping crowd video (a still for reduced
 * motion), with the next announced gig docked along the bottom edge. While a
 * gig is live the line under the logo says so and the strip becomes the live
 * strip (solid accent once doors are open).
 */
export function HomeHero() {
  const motionAllowed = useMotionAllowed();
  const live = useLiveGig();
  const venue = useVenue(live?.gig);

  return (
    <section className="relative flex h-dvh min-h-[560px] flex-col overflow-hidden">
      <div className="absolute inset-0 opacity-70">
        <Media
          src="/home/atmos-1.jpg"
          alt=""
          sizes="100vw"
          priority
          className="absolute inset-0"
        />
        {motionAllowed ? (
          <video
            autoPlay
            loop
            muted
            playsInline
            aria-hidden
            className="absolute inset-0 size-full object-cover"
          >
            <source src="/home/atmos-home.mp4" type="video/mp4" />
          </video>
        ) : null}
      </div>
      <div className="absolute inset-0 bg-black/45" />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-6 pt-20">
        <h1>
          <AtmosLogo className="w-[min(72vw,640px)]" />
        </h1>
        <p className="t-label text-center text-[12px] text-white/75 md:text-[14px]">
          {live?.phase === "on"
            ? `On now at ${venue.name}`
            : live?.phase === "tonight"
              ? `Tonight at ${venue.name}`
              : "Electronic music · Pōneke"}
        </p>
      </div>

      {live ? (
        <LiveStrip
          gig={live.gig}
          phase={live.phase}
          now={live.now}
          venue={venue}
        />
      ) : (
        <NextGigStrip />
      )}
    </section>
  );
}

const stripClass =
  "glass-dark relative z-10 grid min-h-[88px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-x-0 border-b-0 px-5 py-4 md:gap-8 md:px-10 lg:grid-cols-[auto_minmax(0,1fr)_auto_auto]";

/** The next gig the public can see, as an edge-to-edge glass strip. Nothing when none is announced. */
function NextGigStrip() {
  const upcoming = api.gigs.getUpcoming.useQuery();

  if (upcoming.isPending) {
    return (
      <div className={stripClass} aria-busy>
        <Skeleton className="h-14 w-14 rounded-[var(--site-r-chip)] bg-white/10" />
        <div className="space-y-2.5">
          <Skeleton className="h-5 w-2/3 max-w-[420px] rounded-full bg-white/10" />
          <Skeleton className="h-3.5 w-1/3 max-w-[200px] rounded-full bg-white/10" />
        </div>
        <Skeleton className="size-11 rounded-full bg-white/10 sm:w-36" />
      </div>
    );
  }

  const gig = upcoming.data?.find(
    (g) => g.mode !== "TO_BE_ANNOUNCED" && gigOffSiteNotice(g) === null,
  );
  if (!gig) return null;

  return (
    <div className={stripClass}>
      <div className="flex w-14 flex-col items-center rounded-[var(--site-r-chip)] bg-[var(--site-accent)] py-1.5 text-[var(--site-accent-ink)]">
        <span className="t-label text-[10px]">
          {nzDate.shortMonth.format(gig.gigStartTime)}
        </span>
        <span className="t-display text-2xl tabular-nums">
          {nzDate.day.format(gig.gigStartTime)}
        </span>
      </div>
      <div className="min-w-0">
        {/* The title link covers the strip; the ticket pill sits above it. */}
        <Link
          href={gigPath(gig)}
          className="block after:absolute after:inset-0 hover:text-[var(--site-accent-text)]"
        >
          <span className="t-display line-clamp-2 text-lg break-words normal-case sm:text-xl md:line-clamp-1 md:text-2xl">
            {gig.title}
          </span>
        </Link>
        <p className="mt-1.5 truncate text-sm text-white/65">
          {[
            nzDate.weekday.format(gig.gigStartTime),
            gig.subtitle,
            formatEventTime(gig.gigStartTime),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="hidden lg:block">
        <GigCountdown night={nightOf(gig)} compact />
      </div>
      <TicketPill gig={gig} />
    </div>
  );
}

type Cta = {
  label: string;
  href: string | null;
  external?: boolean;
  tone: "buy" | "external" | "muted" | "details";
};

/** `GigTicketCta`'s rules: an on-site event wins, then the external link, else the gig page. */
function ticketCta(
  event: RouterOutputs["ticketEvents"]["forGig"],
  gig: CtaGig,
): Cta {
  if (event) {
    if (event.status === "CANCELLED")
      return { label: "Cancelled", href: null, tone: "muted" };
    const href = `/events/${event.slug}`;
    if (event.status === "SOLD_OUT")
      return { label: "Sold out", href, tone: "muted" };
    if (event.fromPriceCents === 0)
      return { label: "Free tickets", href, tone: "buy" };
    return {
      label:
        event.fromPriceCents === null
          ? "Tickets"
          : `Tickets from ${formatNZDCompact(event.fromPriceCents)}`,
      href,
      tone: "buy",
    };
  }
  if (gig.ticketLink)
    return {
      label: "Get tickets",
      href: gig.ticketLink,
      external: true,
      tone: "external",
    };
  return { label: "Details", href: gigPath(gig), tone: "details" };
}

/**
 * Ticket call to action. Arrow-only on phones, label from `sm` up. `onAccent`
 * swaps to black so it reads on the accent-filled live strip.
 */
function TicketPill({ gig, onAccent }: { gig: CtaGig; onAccent?: boolean }) {
  const event = api.ticketEvents.forGig.useQuery({ gigId: gig.id });

  if (event.isPending)
    return <Skeleton className="size-11 rounded-full bg-white/10 sm:w-36" />;

  const cta = ticketCta(event.data ?? null, gig);
  const Icon = cta.href === null ? X : cta.external ? ArrowUpRight : ArrowRight;
  const className = cn(
    buttonVariants({
      variant:
        cta.tone === "buy"
          ? "accent"
          : cta.tone === "external"
            ? "solid"
            : "outline",
    }),
    "relative z-10 max-sm:w-11 max-sm:px-0",
    cta.tone === "muted" && "border-white/20 text-white/60",
    onAccent &&
      (cta.tone === "muted"
        ? "border-black/30 text-black/60"
        : "border-transparent bg-black text-white hover:bg-black/85 hover:brightness-100"),
  );
  const content = (
    <>
      <span className="max-sm:sr-only">{cta.label}</span>
      <Icon className="size-4" />
    </>
  );

  if (cta.href === null) return <span className={className}>{content}</span>;
  if (cta.external)
    return (
      <a
        href={cta.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {content}
      </a>
    );
  return (
    <Link href={cta.href} className={className}>
      {content}
    </Link>
  );
}

type Venue = { name: string; mapsUrl: string };

/** Venue name and a maps link, from the gig's ticket event when it has one. */
function useVenue(gig: TodayGig | undefined): Venue {
  const event = api.ticketEvents.forGig.useQuery(
    { gigId: gig?.id ?? "" },
    { enabled: !!gig },
  );
  const name = event.data?.venueName ?? gig?.subtitle ?? "";
  const query = [name, event.data?.venueAddress, "Wellington"]
    .filter(Boolean)
    .join(", ");
  return {
    name,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
  };
}

const liveChipLabel: Record<LivePhase, string> = {
  tonight: "Tonight",
  on: "On now",
  wrap: "That's a wrap",
};

/**
 * The docked strip while a gig is live. Before doors it counts down; once
 * doors are open it goes solid accent with the night's progress; after close
 * it thanks people and points at the next gig. The chip's dot is solid:
 * nothing on the page loops.
 */
function LiveStrip({
  gig,
  phase,
  now,
  venue,
}: {
  gig: TodayGig;
  phase: LivePhase;
  now: number;
  venue: Venue;
}) {
  const on = phase === "on";
  const start = gig.gigStartTime;
  const end = nightEnd(gig);
  const progress = Math.min(
    100,
    Math.max(
      0,
      ((now - start.getTime()) / (end.getTime() - start.getTime())) * 100,
    ),
  );

  const detail =
    phase === "wrap"
      ? `Thanks for coming. ${venue.name ? `Doors closed at ${venue.name}.` : ""}`.trim()
      : [
          venue.name,
          gig.gigEndTime
            ? `Doors ${formatEventTime(start)} till ${formatEventTime(gig.gigEndTime)}`
            : `Doors ${formatEventTime(start)}`,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <div
      className={cn(
        "relative z-10 px-5 py-5 md:px-10",
        on
          ? "bg-[var(--site-accent)] text-[var(--site-accent-ink)]"
          : "glass-dark border-x-0 border-b-0",
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-4 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,300px)_auto]">
        <span
          className={cn(
            "t-label inline-flex h-8 w-fit items-center gap-2 rounded-full border px-3.5 text-[11px]",
            on ? "border-black/80" : "border-white/40",
          )}
        >
          <span
            className={cn(
              "size-2 rounded-full",
              on ? "bg-black" : "bg-white/70",
            )}
            aria-hidden
          />
          {liveChipLabel[phase]}
        </span>
        <div className="min-w-0 max-lg:col-span-2 max-lg:row-start-2">
          <Link
            href={gigPath(gig)}
            className={cn(
              "block after:absolute after:inset-0",
              !on && "hover:text-[var(--site-accent-text)]",
            )}
          >
            <span className="t-display line-clamp-2 text-lg break-words normal-case sm:text-xl md:line-clamp-1 md:text-2xl">
              {gig.title}
            </span>
          </Link>
          <p
            className={cn(
              "mt-1.5 truncate text-sm",
              on ? "text-black/70" : "text-white/65",
            )}
          >
            {detail}
          </p>
        </div>
        <div className="hidden lg:block">
          {on && gig.gigEndTime ? (
            <div
              role="progressbar"
              aria-label="How far through the night"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="relative h-1.5 overflow-hidden rounded-full bg-black/20"
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-black transition-[width] duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
          ) : phase === "tonight" ? (
            <CountdownTiles target={start} compact />
          ) : null}
        </div>
        <div className="relative z-10 col-start-2 row-start-1 flex gap-2 lg:col-start-auto lg:row-start-auto">
          {phase === "wrap" ? (
            <NextGigLink skipId={gig.id} />
          ) : (
            <>
              <a
                href={venue.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Directions to ${venue.name}`}
                className={cn(
                  "flex size-11 items-center justify-center rounded-full",
                  on
                    ? "bg-black/10 hover:bg-black/20"
                    : "glass hover:bg-white/15",
                )}
              >
                <Navigation className="size-4" />
              </a>
              <TicketPill gig={gig} onAccent={on} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** After close: the next announced gig, or the gigs page if there isn't one. */
function NextGigLink({ skipId }: { skipId: string }) {
  const upcoming = api.gigs.getUpcoming.useQuery();
  const next = upcoming.data?.find(
    (g) =>
      g.id !== skipId &&
      g.mode !== "TO_BE_ANNOUNCED" &&
      gigOffSiteNotice(g) === null,
  );
  return (
    <Link
      href={next ? gigPath(next) : "/gigs"}
      className={cn(
        buttonVariants({ variant: "accent" }),
        "max-sm:w-11 max-sm:px-0",
      )}
    >
      <span className="max-sm:sr-only">{next ? "Next gig" : "All gigs"}</span>
      <ArrowRight className="size-4" />
    </Link>
  );
}
