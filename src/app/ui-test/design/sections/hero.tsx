"use client";

import { ArrowRight, Menu, ShoppingBag } from "lucide-react";
import { cn } from "~/lib/utils";
import {
  formatDay,
  formatTime,
  listingGigs,
  navLinks,
  photos,
  upcomingGigs,
  type MockGig,
} from "../fixtures";
import {
  AtmosLogo,
  Button,
  IconButton,
  Media,
  VariantTag,
  useCountdown,
} from "../primitives";

const next = upcomingGigs[0];
const then = listingGigs.slice(1, 5);

function Countdown({
  target,
  compact = false,
}: {
  target: Date | null;
  compact?: boolean;
}) {
  const t = useCountdown(target);
  const cells = [
    { label: "Days", value: t?.days },
    { label: "Hrs", value: t?.hours },
    { label: "Min", value: t?.minutes },
    { label: "Sec", value: t?.seconds },
  ];

  return (
    <div
      className={cn("grid grid-cols-4", compact ? "gap-1.5" : "gap-2 md:gap-3")}
      role="timer"
      aria-label="Time until doors"
    >
      {cells.map((cell, i) => (
        <div
          key={cell.label}
          className={cn(
            "mx-glass flex flex-col items-center justify-center rounded-xl",
            compact ? "h-16 min-w-14" : "h-24 min-w-20 md:h-28 md:min-w-28",
          )}
        >
          <span
            className={cn(
              "mx-display mx-num",
              compact ? "text-2xl" : "text-4xl md:text-5xl",
              i === 0 && "text-[var(--mx-accent-text)]",
            )}
          >
            {cell.value === undefined
              ? "--"
              : String(cell.value).padStart(2, "0")}
          </span>
          <span
            className={cn(
              "mx-label text-white/65",
              compact ? "mt-1 text-[8px]" : "mt-2 text-[10px]",
            )}
          >
            {cell.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function SplitNav() {
  return (
    <nav className="absolute inset-x-0 top-0 z-20 flex h-20 items-center justify-between px-5 md:px-10">
      <ul className="hidden flex-1 gap-8 lg:flex">
        {navLinks.slice(0, 3).map((l) => (
          <li key={l}>
            <a
              href="#"
              className={cn(
                "mx-label text-[12px] transition-opacity hover:opacity-100",
                l === "Gigs" ? "opacity-100" : "opacity-70",
              )}
            >
              {l}
            </a>
          </li>
        ))}
      </ul>
      <AtmosLogo className="w-28 lg:w-36" />
      <ul className="hidden flex-1 justify-end gap-8 lg:flex">
        {navLinks.slice(3).map((l) => (
          <li key={l}>
            <a
              href="#"
              className="mx-label text-[12px] opacity-70 transition-opacity hover:opacity-100"
            >
              {l}
            </a>
          </li>
        ))}
      </ul>
      <IconButton label="Open menu" className="lg:hidden">
        <Menu className="size-5" />
      </IconButton>
    </nav>
  );
}

function ThenRow({ gig }: { gig: MockGig }) {
  return (
    <a
      href="#"
      className="group grid grid-cols-[56px_1fr_auto] items-center gap-4 border-t border-white/10 py-4"
    >
      <Media
        src={gig.poster}
        alt=""
        sizes="56px"
        className="aspect-[4/5] w-14"
      />
      <div className="min-w-0">
        <p className="mx-display truncate text-lg">{gig.headline}</p>
        <p className="mt-1.5 truncate text-[13px] text-white/60">
          {formatDay(gig.date)} · {gig.venue}
        </p>
      </div>
      <span className="mx-label flex items-center gap-1 text-[11px] text-[var(--mx-accent-text)] transition-transform group-hover:translate-x-0.5">
        {gig.status === "sold-out"
          ? "Sold out"
          : gig.status === "tba"
            ? "Details"
            : "Tickets"}
        <ArrowRight className="size-3.5" />
      </span>
    </a>
  );
}

/** A: DnB-style split. Photo carries the next gig, a solid rail lists what's after. */
function HeroSplit() {
  return (
    <div className="relative grid min-h-[720px] lg:grid-cols-[1fr_420px]">
      <SplitNav />
      <div className="relative flex min-h-[640px] items-end overflow-hidden">
        <Media
          src={photos.crowd}
          alt=""
          sizes="(min-width: 1024px) 70vw, 100vw"
          className="absolute inset-0"
          priority
        />
        <div className="mx-scrim-left absolute inset-0" />
        <div className="mx-scrim-bottom absolute inset-0 lg:hidden" />
        <div className="relative z-10 w-full px-5 pt-32 pb-10 md:px-10 md:pb-14">
          <h1 className="mx-display max-w-[12ch] text-[clamp(2.75rem,7.5vw,6rem)]">
            {next.headline}
          </h1>
          <p className="mx-label mt-5 text-[13px] text-white/80">
            {formatDay(next.date)} · {next.venue} · {formatTime(next.date)}
          </p>
          <div className="mt-8 w-fit">
            <Countdown target={next.date} />
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg">Get tickets</Button>
            <Button size="lg" variant="glass">
              Lineup
            </Button>
          </div>
        </div>
      </div>
      <aside className="bg-[var(--mx-raised)] px-5 pt-10 pb-8 md:px-10 lg:pt-28">
        <h2 className="mx-label mb-4 text-[12px] text-white/50">Then</h2>
        {then.map((gig) => (
          <ThenRow key={gig.slug} gig={gig} />
        ))}
      </aside>
    </div>
  );
}

/** B: full-bleed photo, everything floats on it as glass. */
function HeroGlass() {
  return (
    <div className="relative flex min-h-[760px] flex-col overflow-hidden">
      <Media
        src={photos.booth}
        alt=""
        sizes="100vw"
        className="absolute inset-0"
      />
      <div className="mx-scrim-bottom absolute inset-0" />
      <div className="absolute inset-0 bg-black/40 lg:hidden" />

      <nav className="relative z-20 px-3 pt-3 md:px-6 md:pt-5">
        <div className="mx-glass mx-auto flex h-16 max-w-6xl items-center gap-6 rounded-full pr-2 pl-6">
          <AtmosLogo className="w-24" />
          <ul className="mx-auto hidden gap-7 lg:flex">
            {navLinks.map((l) => (
              <li key={l}>
                <a
                  href="#"
                  className={cn(
                    "mx-label text-[11px]",
                    l === "Gigs"
                      ? "text-white"
                      : "text-white/65 hover:text-white",
                  )}
                >
                  {l}
                </a>
              </li>
            ))}
          </ul>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <button
              type="button"
              aria-label="Cart"
              className="inline-flex size-12 items-center justify-center rounded-full text-white/80 hover:text-white"
            >
              <ShoppingBag className="size-5" />
            </button>
            <Button variant="accent" className="h-12 max-sm:hidden">
              Tickets
            </Button>
            <IconButton label="Open menu" className="size-12 lg:hidden">
              <Menu className="size-5" />
            </IconButton>
          </div>
        </div>
      </nav>

      <div className="relative z-10 mt-auto grid items-end gap-8 px-5 pb-8 md:px-10 md:pb-12 lg:grid-cols-[1fr_400px]">
        <div>
          <h1 className="mx-display text-[clamp(2.75rem,8vw,6rem)]">
            Intuition
            <br />
            Vol.3
          </h1>
          <p className="mt-5 max-w-[46ch] text-base text-white/75">
            broderbeats brings the Intuition tour home to San Fran, with Sunday,
            Special K and Taiji.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg">Get tickets</Button>
            <Button size="lg" variant="outline">
              Details
            </Button>
          </div>
        </div>

        <div className="mx-glass-dark rounded-[var(--mx-r-panel)] rounded-tl-none p-4">
          <div className="grid grid-cols-[72px_1fr] gap-4">
            <Media
              src={next.poster}
              alt=""
              sizes="72px"
              className="aspect-[4/5]"
            />
            <div className="flex flex-col justify-center">
              <p className="mx-label text-[12px]">{formatDay(next.date)}</p>
              <p className="mt-1.5 text-sm text-white/65">
                {next.venue} · Doors {formatTime(next.date)}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Countdown target={next.date} compact />
          </div>
        </div>
      </div>
    </div>
  );
}

/** C: brand-first home. Logo on photo, next gig docked as an edge-to-edge strip. */
function HeroLogo() {
  const gig = next;
  return (
    <div className="relative flex min-h-[720px] flex-col overflow-hidden">
      <Media
        src={photos.lights}
        alt=""
        sizes="100vw"
        className="absolute inset-0 opacity-70"
      />
      <div className="absolute inset-0 bg-black/45" />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-6">
        <AtmosLogo className="w-[min(72vw,640px)]" />
        <p className="mx-label text-center text-[12px] text-white/75 md:text-[14px]">
          Electronic music · Pōneke
        </p>
      </div>

      {/* Hard edges: it spans the viewport. Round only on the control inside. */}
      <a
        href="#"
        className="mx-glass-dark relative z-10 grid grid-cols-[auto_1fr_auto] items-center gap-4 border-x-0 border-b-0 px-5 py-4 md:grid-cols-[auto_1fr_auto_auto] md:gap-8 md:px-10"
      >
        <div className="flex flex-col items-center rounded-[var(--mx-r-chip)] bg-[var(--mx-accent)] px-3 py-1.5 text-[var(--mx-accent-ink)]">
          <span className="mx-label text-[10px]">Oct</span>
          <span className="mx-display mx-num text-2xl">09</span>
        </div>
        <div className="min-w-0">
          <p className="mx-display truncate text-lg sm:text-xl md:text-2xl">
            {gig.headline}
          </p>
          <p className="mt-1 truncate text-sm text-white/65">
            {gig.venue} · {formatTime(gig.date)}
          </p>
        </div>
        <div className="hidden md:block">
          <Countdown target={gig.date} compact />
        </div>
        <span className="mx-label inline-flex size-11 items-center justify-center gap-2 rounded-full bg-white text-[12px] text-black sm:w-auto sm:px-5">
          <span className="max-sm:sr-only">Tickets</span>{" "}
          <ArrowRight className="size-4" />
        </span>
      </a>
    </div>
  );
}

export function HeroSection() {
  return (
    <div className="space-y-14 pb-16">
      <div>
        <VariantTag>A · Split, solid rail</VariantTag>
        <HeroSplit />
      </div>
      <div>
        <VariantTag>B · Full bleed, floating glass</VariantTag>
        <HeroGlass />
      </div>
      <div>
        <VariantTag>C · Logo home, docked next gig</VariantTag>
        <HeroLogo />
      </div>
    </div>
  );
}
