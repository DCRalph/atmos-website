"use client";

import { useSyncExternalStore } from "react";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, MapPin, Navigation } from "lucide-react";
import { cn } from "~/lib/utils";
import { lineup, photos, upcomingGigs } from "../fixtures";
import { AtmosLogo, Media, buttonVariants } from "../primitives";
import { CountdownTiles } from "./gigs-parts";
import type { PageSpec } from "./types";

/**
 * Home page while a gig is on. `gigs.getToday` already says which gig is in
 * its window (the day before until 5am after); these drafts split that window
 * into phases by the gig's own times: tonight, on now, and wrapped. Set times
 * never go public, so the line-up is running order only.
 */

type Phase = "tonight" | "on" | "wrap";
type Scenario = {
  phase: Phase;
  start: Date;
  end: Date;
  soldOut: boolean;
};

// Scenario times hang off the moment the board loaded, so every state is
// "live" whenever it's opened. Illustrative, not real gig times.
const ANCHOR = Date.now();
const H = 3_600_000;
const scenarios: Record<string, Scenario> = {
  tonight: {
    phase: "tonight",
    start: new Date(ANCHOR + 3 * H),
    end: new Date(ANCHOR + 9 * H),
    soldOut: false,
  },
  "on-now": {
    phase: "on",
    start: new Date(ANCHOR - 2 * H),
    end: new Date(ANCHOR + 4 * H),
    soldOut: false,
  },
  "sold-out": {
    phase: "on",
    start: new Date(ANCHOR - 2 * H),
    end: new Date(ANCHOR + 4 * H),
    soldOut: true,
  },
  wrap: {
    phase: "wrap",
    start: new Date(ANCHOR - 7 * H),
    end: new Date(ANCHOR - 0.7 * H),
    soldOut: false,
  },
};

const gig = upcomingGigs[0];
const nextGig = upcomingGigs[1];
const VENUE = "San Fran";
const ADDRESS = "171 Cuba Street, Te Aro";
const MAPS = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${VENUE}, ${ADDRESS}, Wellington`)}`;

const timeF = new Intl.DateTimeFormat("en-NZ", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "Pacific/Auckland",
});
const t = (d: Date) => timeF.format(d).replace(/\s/g, "").toLowerCase();

// Minute clock: the night bar moves once a minute, nothing animates in between.
const subscribeMinutes = (tick: () => void) => {
  const id = setInterval(tick, 30_000);
  return () => clearInterval(id);
};
const useMinute = () =>
  useSyncExternalStore(
    subscribeMinutes,
    () => Math.floor(Date.now() / 60_000) * 60_000,
    () => null,
  );

const chipLabel: Record<Phase, string> = {
  tonight: "Tonight",
  on: "On now",
  wrap: "That's a wrap",
};

/** Status chip. A solid dot, not a pulse: nothing loops on the page. */
function LiveChip({ phase, className }: { phase: Phase; className?: string }) {
  return (
    <span
      className={cn(
        "mx-label inline-flex h-8 items-center gap-2 rounded-full px-3.5 text-[11px]",
        phase === "on"
          ? "bg-[var(--mx-accent)] text-[var(--mx-accent-ink)]"
          : "border border-white/40 text-white",
        className,
      )}
    >
      <span
        className={cn(
          "size-2 rounded-full",
          phase === "on" ? "bg-[var(--mx-accent-ink)]" : "bg-white/70",
        )}
        aria-hidden
      />
      {chipLabel[phase]}
    </span>
  );
}

/** Doors to close, with how far through the night we are. */
function NightBar({ s, className }: { s: Scenario; className?: string }) {
  const now = useMinute();
  const span = s.end.getTime() - s.start.getTime();
  const pct =
    now === null
      ? 0
      : Math.min(100, Math.max(0, ((now - s.start.getTime()) / span) * 100));
  return (
    <div className={className}>
      <div
        className="relative h-1.5 overflow-hidden rounded-full bg-white/15"
        role="progressbar"
        aria-label="How far through the night"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[var(--mx-accent)] transition-[width] duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mx-label mt-2.5 flex justify-between text-[10px] text-white/65">
        <span>Doors {t(s.start)}</span>
        <span>Close {t(s.end)}</span>
      </div>
    </div>
  );
}

/** Tickets, directions, gig page: what someone heading out tonight needs. */
function LiveActions({ s, compact }: { s: Scenario; compact?: boolean }) {
  const size = compact ? "md" : "lg";
  if (s.phase === "wrap") {
    return (
      <div className="flex flex-wrap gap-3">
        <a href="#" className={buttonVariants({ size })}>
          Next gig <ArrowRight className="size-4" />
        </a>
        <a href="#" className={buttonVariants({ size, variant: "glass" })}>
          Photos soon on @atmos.nz
        </a>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-3">
      {s.soldOut ? (
        <span
          className={cn(
            buttonVariants({ size, variant: "outline" }),
            "pointer-events-none border-white/25 text-white/60",
          )}
        >
          Sold out
        </span>
      ) : (
        <a href="#" className={buttonVariants({ size, variant: "accent" })}>
          {s.phase === "on" ? "Tickets, still on sale" : "Get tickets"}
        </a>
      )}
      <a
        href={MAPS}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants({ size, variant: "glass" })}
      >
        <Navigation className="size-4" /> Directions
      </a>
    </div>
  );
}

/** Running order, no times (set times never go public). */
function RunningOrder({ className }: { className?: string }) {
  return (
    <ol className={cn("divide-y divide-white/10", className)}>
      {lineup.map((a, i) => (
        <li key={a.name} className="flex items-center gap-3 py-2.5">
          <span className="mx-label mx-num w-5 text-[10px] text-white/45">
            {String(i + 1).padStart(2, "0")}
          </span>
          <Image
            src={a.image}
            alt=""
            width={32}
            height={32}
            className="size-8 rounded-full object-cover"
          />
          <span
            className={cn(
              "mx-display flex-1 truncate",
              i === 0 ? "text-base" : "text-sm text-white/85",
            )}
          >
            {a.name}
          </span>
          <span className="mx-label text-[9px] text-white/50">{a.role}</span>
        </li>
      ))}
    </ol>
  );
}

const Backdrop = ({ dim = "bg-black/55" }: { dim?: string }) => (
  <>
    <Media
      src={gig.poster}
      alt=""
      sizes="100vw"
      className="absolute inset-0 scale-125 opacity-70 blur-3xl"
    />
    <Media
      src={photos.crowd}
      alt=""
      sizes="100vw"
      className="absolute inset-0 opacity-40 mix-blend-luminosity"
    />
    <div className={cn("absolute inset-0", dim)} />
  </>
);

// ---------------------------------------------------------------------------
// A · Takeover

/** The gig replaces the logo hero outright. */
function DraftTakeover({ state }: { state: string }) {
  const s = scenarios[state] ?? scenarios["on-now"]!;
  return (
    <section className="relative flex min-h-dvh flex-col justify-end overflow-hidden">
      <Backdrop />
      <div className="mx-scrim-bottom absolute inset-0" />
      <div className="relative grid grid-cols-1 items-end gap-10 px-5 pt-28 pb-10 md:px-10 md:pb-14 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <LiveChip phase={s.phase} />
          <h1 className="mx-display mt-6 max-w-[14ch] text-[clamp(2.5rem,7.5vw,6.5rem)] [overflow-wrap:anywhere]">
            {s.phase === "wrap" ? "Thanks for coming" : gig.headline}
          </h1>
          <p className="mx-label mt-5 flex items-center gap-2 text-[12px] text-white/85 md:text-[13px]">
            <MapPin className="size-4" aria-hidden />
            {s.phase === "wrap"
              ? `${gig.headline} · ${VENUE}`
              : `${VENUE} · ${ADDRESS}`}
          </p>
          {s.phase === "tonight" ? (
            <div className="mt-8 w-fit max-w-full">
              <p className="mx-label mb-3 text-[11px] text-white/65">
                Doors open in
              </p>
              <CountdownTiles target={s.start} />
            </div>
          ) : s.phase === "on" ? (
            <NightBar s={s} className="mt-8 max-w-[520px]" />
          ) : null}
          <div className="mt-8">
            <LiveActions s={s} />
          </div>
        </div>
        {s.phase === "wrap" ? (
          <a
            href="#"
            className="mx-glass-dark group rounded-[var(--mx-r-panel)] rounded-tl-none p-4"
          >
            <p className="mx-label text-[10px] text-white/60">Next up</p>
            <div className="mt-3 grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-4">
              <Media
                src={nextGig.poster}
                alt=""
                sizes="64px"
                className="aspect-[4/5] blur-sm"
              />
              <p className="mx-display truncate text-lg">To be announced</p>
              <ArrowUpRight className="size-5 text-white/60 group-hover:text-white" />
            </div>
          </a>
        ) : (
          <div className="mx-glass-dark rounded-[var(--mx-r-panel)] rounded-tl-none p-4">
            <Media
              src={gig.poster}
              alt={`${gig.title} poster`}
              sizes="340px"
              className="aspect-[4/5]"
            />
            <RunningOrder className="mt-3" />
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// B · Live strip

/** The logo hero stays; the docked strip turns solid accent and louder. */
function DraftStrip({ state }: { state: string }) {
  const s = scenarios[state] ?? scenarios["on-now"]!;
  const on = s.phase === "on";
  return (
    <section className="relative flex h-dvh min-h-[560px] flex-col overflow-hidden">
      <Media
        src={photos.lights}
        alt=""
        sizes="100vw"
        className="absolute inset-0 opacity-70"
      />
      <div className="absolute inset-0 bg-black/45" />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-6 pt-20">
        <AtmosLogo className="w-[min(72vw,640px)]" />
        <p className="mx-label text-center text-[12px] text-white/80 md:text-[14px]">
          {on
            ? `On now at ${VENUE}`
            : s.phase === "tonight"
              ? `Tonight at ${VENUE}`
              : "Electronic music · Pōneke"}
        </p>
      </div>
      <div
        className={cn(
          "relative z-10 px-5 py-5 md:px-10",
          on
            ? "bg-[var(--mx-accent)] text-[var(--mx-accent-ink)]"
            : "mx-glass-dark border-x-0 border-b-0",
        )}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-4 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,300px)_auto]">
          <LiveChip
            phase={s.phase}
            className={cn(on && "border border-black/80 bg-transparent")}
          />
          <div className="min-w-0 max-lg:col-span-2 max-lg:row-start-2">
            <p className="mx-display truncate text-xl md:text-2xl">
              {s.phase === "wrap" ? "That's a wrap" : gig.headline}
            </p>
            <p
              className={cn(
                "mt-1 truncate text-[14px]",
                on ? "text-black/70" : "text-white/65",
              )}
            >
              {s.phase === "wrap"
                ? `Thanks for coming to ${gig.headline}`
                : `${VENUE} · Doors ${t(s.start)} till ${t(s.end)}`}
            </p>
          </div>
          <div className="hidden lg:block">
            {on ? (
              <div className="relative h-1.5 overflow-hidden rounded-full bg-black/20">
                <NightFill s={s} />
              </div>
            ) : s.phase === "tonight" ? (
              <CountdownTiles target={s.start} compact />
            ) : null}
          </div>
          <div className="col-start-2 row-start-1 flex gap-2 lg:col-start-auto lg:row-start-auto">
            {s.phase !== "wrap" ? (
              <a
                href={MAPS}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Directions"
                className={cn(
                  "flex size-11 items-center justify-center rounded-full",
                  on ? "bg-black/10 hover:bg-black/20" : "mx-glass",
                )}
              >
                <Navigation className="size-4" />
              </a>
            ) : null}
            <a
              href="#"
              className={cn(
                buttonVariants({ variant: on ? "solid" : "accent" }),
                on && "bg-black text-white hover:bg-black/85",
                "max-sm:w-11 max-sm:px-0",
              )}
            >
              <span className="max-sm:sr-only">
                {s.phase === "wrap"
                  ? "Next gig"
                  : s.soldOut
                    ? "Sold out"
                    : "Tickets"}
              </span>
              <ArrowRight className="size-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Night progress as a bare fill, for use on the accent strip. */
function NightFill({ s }: { s: Scenario }) {
  const now = useMinute();
  const pct =
    now === null
      ? 0
      : Math.min(
          100,
          Math.max(
            0,
            ((now - s.start.getTime()) /
              (s.end.getTime() - s.start.getTime())) *
              100,
          ),
        );
  return (
    <div
      className="absolute inset-y-0 left-0 rounded-full bg-black"
      style={{ width: `${pct}%` }}
    />
  );
}

// ---------------------------------------------------------------------------
// C · Split

/** Logo keeps the left; the right half is tonight's run sheet for the public. */
function DraftSplit({ state }: { state: string }) {
  const s = scenarios[state] ?? scenarios["on-now"]!;
  return (
    <section className="relative grid min-h-dvh grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
      <div className="relative flex min-h-[46vh] items-center justify-center overflow-hidden px-6 pt-20 max-lg:order-2">
        <Media
          src={photos.booth}
          alt=""
          sizes="60vw"
          className="absolute inset-0 opacity-70"
        />
        <div className="absolute inset-0 bg-black/45" />
        <AtmosLogo className="relative w-[min(60vw,480px)]" />
      </div>
      <div className="relative flex flex-col justify-center gap-7 overflow-hidden px-5 pt-24 pb-10 md:px-10 lg:pt-28">
        <Backdrop dim="bg-black/70" />
        <div className="relative">
          <LiveChip phase={s.phase} />
          <h1 className="mx-display mt-5 text-[clamp(2.25rem,5vw,4rem)] [overflow-wrap:anywhere]">
            {s.phase === "wrap" ? "That's a wrap" : gig.headline}
          </h1>
          <p className="mt-3 text-[15px] text-white/75">
            {s.phase === "wrap"
              ? `Thanks for coming to ${gig.headline} at ${VENUE}.`
              : `${VENUE}, ${ADDRESS}. Doors ${t(s.start)}, close ${t(s.end)}.`}
          </p>
        </div>
        {s.phase === "on" ? (
          <NightBar s={s} className="relative" />
        ) : s.phase === "tonight" ? (
          <div className="relative w-fit max-w-full">
            <CountdownTiles target={s.start} compact />
          </div>
        ) : null}
        {s.phase !== "wrap" ? (
          <div className="relative">
            <p className="mx-label mb-1 text-[11px] text-white/60">
              Running order
            </p>
            <RunningOrder />
          </div>
        ) : null}
        <div className="relative">
          <LiveActions s={s} compact />
        </div>
      </div>
    </section>
  );
}

export const homeLivePage: PageSpec = {
  id: "home-live",
  title: "Home · live",
  route: "/",
  states: [
    {
      id: "tonight",
      label: "Tonight",
      hint: "Gig day, before doors. Times are relative to when the board loaded.",
    },
    {
      id: "on-now",
      label: "On now",
      hint: "Doors open, tickets still on sale.",
    },
    { id: "sold-out", label: "On now, sold out" },
    {
      id: "wrap",
      label: "Wrapped",
      hint: "After close, until the 5am cutoff.",
    },
  ],
  drafts: [
    {
      id: "a",
      label: "A · Takeover",
      note: "The gig replaces the logo hero: status chip, huge title, night progress, directions, poster and running order.",
      Component: DraftTakeover,
      heroUnderHeader: true,
    },
    {
      id: "b",
      label: "B · Live strip",
      note: "Logo hero stays; the docked strip goes solid acid with the night's progress, directions and tickets.",
      Component: DraftStrip,
      heroUnderHeader: true,
    },
    {
      id: "c",
      label: "C · Split",
      note: "Logo on one side, tonight's details and running order on the other.",
      Component: DraftSplit,
      heroUnderHeader: true,
    },
  ],
};
