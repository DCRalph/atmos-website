"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Search,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils";
import {
  formatDay,
  formatLongMonth,
  formatMonth,
  formatTime,
  formatYear,
  listingGigs,
  pastGigs,
  upcomingGigs,
  type MockGig,
} from "../fixtures";
import { GlassSelect } from "../inputs";
import { Button, IconButton, Media, VariantTag } from "../primitives";

const statusLabel: Record<MockGig["status"], string> = {
  "on-sale": "Tickets",
  "sold-out": "Sold out",
  tba: "Details",
  free: "RSVP",
  past: "Recap",
};

function DateChip({ date }: { date: Date }) {
  return (
    <div className="flex w-14 flex-col overflow-hidden rounded-[var(--mx-r-chip)] text-center">
      <span className="mx-label bg-[var(--mx-accent)] py-1 text-[10px] text-[var(--mx-accent-ink)]">
        {formatMonth(date)}
      </span>
      <span className="mx-label mx-num bg-white/10 py-1 text-[10px] text-white/80">
        {formatYear(date)}
      </span>
    </div>
  );
}

function ListRow({ gig }: { gig: MockGig }) {
  const soldOut = gig.status === "sold-out";
  return (
    <li>
      <a
        href="#"
        className="group grid grid-cols-[64px_1fr_auto] items-center gap-4 border-b border-white/10 py-4 transition-colors hover:bg-white/[0.03] md:grid-cols-[72px_88px_1fr_auto] md:gap-6 md:px-3"
      >
        <Media
          src={gig.poster}
          alt=""
          sizes="72px"
          className={cn(
            "aspect-[4/5] w-16 md:w-[72px]",
            soldOut && "opacity-50 grayscale",
          )}
        />
        <div className="hidden md:block">
          <p className="mx-display mx-num text-4xl">
            {gig.date
              ? gig.date.toLocaleDateString("en-NZ", {
                  day: "2-digit",
                  timeZone: "Pacific/Auckland",
                })
              : "--"}
          </p>
          <p className="mx-label mt-1 text-[10px] text-white/55">
            {gig.date
              ? gig.date.toLocaleDateString("en-NZ", {
                  weekday: "short",
                  timeZone: "Pacific/Auckland",
                })
              : "TBA"}
          </p>
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              "mx-display truncate text-lg md:text-2xl",
              soldOut && "text-white/55",
            )}
          >
            {gig.headline}
          </p>
          <p className="mt-1.5 truncate text-[13px] text-white/60">
            <span className="md:hidden">{formatDay(gig.date)} · </span>
            {gig.venue}
            {gig.date ? ` · ${formatTime(gig.date)}` : ""}
          </p>
        </div>
        {soldOut ? (
          <span className="mx-label rounded-full border border-white/20 px-4 py-2.5 text-[10px] text-white/55">
            Sold out
          </span>
        ) : (
          <span
            className={cn(
              "mx-label rounded-full px-4 py-2.5 text-[10px] transition-colors",
              gig.status === "on-sale"
                ? "bg-white text-black group-hover:bg-[var(--mx-accent)] group-hover:text-[var(--mx-accent-ink)]"
                : "border border-white/40 text-white",
            )}
          >
            {statusLabel[gig.status]}
          </span>
        )}
      </a>
    </li>
  );
}

type MonthGroup = { key: string; month: Date | null; gigs: MockGig[] };

/** Groups in the given order; undated gigs collect in a trailing TBA group. */
function groupByMonth(gigs: MockGig[]): MonthGroup[] {
  const groups = new Map<string, MonthGroup>();
  for (const g of gigs) {
    const key = g.date ? `${formatYear(g.date)}-${formatMonth(g.date)}` : "tba";
    const group = groups.get(key) ?? { key, month: g.date, gigs: [] };
    groups.set(key, { ...group, gigs: [...group.gigs, g] });
  }
  return [...groups.values()].sort(
    (a, b) => Number(a.month === null) - Number(b.month === null),
  );
}

function MonthGroups({ gigs }: { gigs: MockGig[] }) {
  return groupByMonth(gigs).map(({ key, month, gigs }) => (
    <section key={key} className="mb-10 last:mb-0">
      <header className="flex items-center gap-4 border-b border-white/10 pb-4">
        {month ? (
          <DateChip date={month} />
        ) : (
          <span className="mx-label flex h-[52px] w-14 items-center justify-center rounded-[var(--mx-r-chip)] border border-dashed border-white/30 text-[10px] text-white/70">
            TBA
          </span>
        )}
        <h4 className="mx-display text-2xl">
          {month ? formatLongMonth(month) : "Coming up"}
        </h4>
      </header>
      <ul>
        {gigs.map((g) => (
          <ListRow key={g.slug} gig={g} />
        ))}
      </ul>
    </section>
  ));
}

const cardStyles = { plate: "Plate", stub: "Stub", notch: "Notch" } as const;
type CardStyle = keyof typeof cardStyles;

/** The Gigs page body: tabs, search, venue, list/grid, with a real empty state. */
function GigBrowser() {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [query, setQuery] = useState("");
  const [venue, setVenue] = useState("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const [cardStyle, setCardStyle] = useState<CardStyle>("notch");

  const source = tab === "upcoming" ? listingGigs : [...pastGigs];
  const venues = [...new Set(source.map((g) => g.venue))];
  const q = query.trim().toLowerCase();
  const results = source.filter(
    (g) =>
      (venue === "all" || g.venue === venue) &&
      (!q || `${g.title} ${g.headline} ${g.venue}`.toLowerCase().includes(q)),
  );
  const filtered = q !== "" || venue !== "all";
  const Card = { plate: CardPlate, stub: CardStub, notch: CardNotch }[
    cardStyle
  ];

  const tabs = [
    { key: "upcoming", label: "Upcoming", count: listingGigs.length },
    { key: "past", label: "Past", count: pastGigs.length },
  ] as const;

  return (
    <div className="px-5 md:px-10">
      <h3 className="mx-display mb-8 text-[clamp(2.25rem,4.5vw,3.5rem)]">
        All gigs
      </h3>

      <div
        role="tablist"
        aria-label="Gigs"
        className="mb-6 flex gap-8 border-b border-white/10"
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => {
              setTab(t.key);
              setVenue("all");
            }}
            className={cn(
              "mx-label -mb-px flex items-baseline gap-2 border-b-2 pb-4 text-[12px] transition-colors",
              tab === t.key
                ? "border-[var(--mx-accent)] text-white"
                : "border-transparent text-white/50 hover:text-white",
            )}
          >
            {t.label}
            <span className="mx-num text-[10px] text-white/45">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <label className="relative min-w-[220px] flex-[2]">
          <span className="sr-only">Search gigs</span>
          <Search className="pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-1/2 text-white/50" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search artists, venues"
            className="h-12 w-full rounded-full border border-white/15 bg-white/[0.04] pr-12 pl-12 text-[15px] text-white outline-none placeholder:text-white/45 hover:border-white/30 focus:border-white/60"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-white/60 hover:text-white"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </label>
        <div className="min-w-[200px] flex-1">
          <GlassSelect
            label="Venue"
            value={venue}
            onValueChange={setVenue}
            options={[
              { value: "all", label: "All venues" },
              ...venues.map((v) => ({ value: v, label: v })),
            ]}
          />
        </div>
        <div
          className="inline-flex rounded-full border border-white/15 p-1"
          role="group"
          aria-label="View"
        >
          {(["list", "grid"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn(
                "mx-label flex h-10 items-center gap-2 rounded-full px-4 text-[11px] transition-colors",
                view === v
                  ? "bg-white text-black"
                  : "text-white/60 hover:text-white",
              )}
            >
              {v === "list" ? (
                <List className="size-4" />
              ) : (
                <LayoutGrid className="size-4" />
              )}
              {v}
            </button>
          ))}
        </div>
        {view === "grid" ? (
          <div
            className="inline-flex rounded-full border border-white/15 p-1"
            role="group"
            aria-label="Card style"
          >
            {(Object.keys(cardStyles) as CardStyle[]).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={cardStyle === c}
                onClick={() => setCardStyle(c)}
                className={cn(
                  "flex h-10 items-center rounded-full px-3.5 text-[12px] transition-colors",
                  cardStyle === c
                    ? "bg-white/15 text-white"
                    : "text-white/55 hover:text-white",
                )}
              >
                {cardStyles[c]}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <p aria-live="polite" className="mb-4 text-[13px] text-white/55">
        {results.length} {results.length === 1 ? "gig" : "gigs"}
        {filtered ? " match" : ""}
      </p>

      {results.length === 0 ? (
        <div className="flex flex-col items-center gap-4 border border-white/10 px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full border border-white/15">
            <Search className="size-5 text-white/60" />
          </span>
          <p className="mx-display text-2xl">No gigs match</p>
          <p className="max-w-[34ch] text-[14px] text-white/60">
            Nothing for {q ? `\u201c${query.trim()}\u201d` : "that"}
            {venue !== "all" ? ` at ${venue}` : ""}. Try another search or
            venue.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setQuery("");
              setVenue("all");
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : view === "list" ? (
        <MonthGroups gigs={results} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {results.map((g) => (
            <Card key={g.slug} gig={g} />
          ))}
        </div>
      )}
    </div>
  );
}

function TbaPoster({ gig, className }: { gig: MockGig; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <Media
        src={gig.poster}
        alt=""
        sizes="400px"
        className="absolute inset-0 scale-110 blur-2xl"
      />
      <div className="absolute inset-0 bg-black/30" />
      <p className="mx-display absolute inset-0 flex items-center justify-center text-5xl">
        TBA
      </p>
    </div>
  );
}

/** A: poster edge to edge, info on a glass plate floating over its foot. */
function CardPlate({ gig }: { gig: MockGig }) {
  return (
    <a href="#" className="group relative block aspect-[4/5] overflow-hidden">
      {gig.status === "tba" ? (
        <TbaPoster gig={gig} className="absolute inset-0" />
      ) : (
        <Media
          src={gig.poster}
          alt={`${gig.title} poster`}
          sizes="(min-width: 1024px) 33vw, 100vw"
          className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        />
      )}
      <div className="mx-glass-dark absolute inset-x-2.5 bottom-2.5 flex items-center gap-4 rounded-xl p-4">
        <div className="min-w-0 flex-1">
          <p className="mx-display truncate text-xl">{gig.headline}</p>
          <p className="mx-label mt-2 truncate text-[10px] text-white/70">
            {formatDay(gig.date)} · {gig.venue}
          </p>
        </div>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-black transition-colors group-hover:bg-[var(--mx-accent)] group-hover:text-[var(--mx-accent-ink)]">
          <ArrowUpRight className="size-5" />
        </span>
      </div>
    </a>
  );
}

/** B: all hard. Poster, meta strip, flush block button. Reads like a ticket stub. */
function CardStub({ gig }: { gig: MockGig }) {
  return (
    <a
      href="#"
      className="group flex flex-col border border-white/15 bg-[var(--mx-raised)]"
    >
      {gig.status === "tba" ? (
        <TbaPoster gig={gig} className="aspect-[4/5]" />
      ) : (
        <Media
          src={gig.poster}
          alt={`${gig.title} poster`}
          sizes="(min-width: 1024px) 33vw, 100vw"
          className="aspect-[4/5]"
        />
      )}
      <div className="p-4">
        <p className="mx-display truncate text-xl">{gig.headline}</p>
      </div>
      <div className="grid grid-cols-3 border-t border-white/15 text-center">
        <span className="mx-label truncate border-r border-white/15 px-2 py-3 text-[10px] text-white/70">
          {gig.venue}
        </span>
        <span className="mx-label border-r border-white/15 px-2 py-3 text-[10px] text-white/70">
          {gig.date ? formatDay(gig.date).slice(4) : "TBA"}
        </span>
        <span className="mx-label px-2 py-3 text-[10px] text-white/70">
          {gig.date ? formatTime(gig.date) : "--"}
        </span>
      </div>
      <span className="mx-label flex h-12 items-center justify-between bg-white px-4 text-[12px] text-black transition-colors group-hover:bg-[var(--mx-accent)] group-hover:text-[var(--mx-accent-ink)]">
        {statusLabel[gig.status]} <ArrowRight className="size-4" />
      </span>
    </a>
  );
}

/** C: rounded card with a square notch. The accent date block lives in the notch. */
function CardNotch({ gig }: { gig: MockGig }) {
  return (
    <a
      href="#"
      className="group relative block overflow-hidden rounded-[var(--mx-r-panel)] rounded-tl-none bg-white/[0.05] ring-1 ring-white/10 transition-colors hover:bg-white/[0.08]"
    >
      {gig.status === "tba" ? (
        <TbaPoster gig={gig} className="aspect-[4/5]" />
      ) : (
        <Media
          src={gig.poster}
          alt={`${gig.title} poster`}
          sizes="(min-width: 1024px) 33vw, 100vw"
          className="aspect-[4/5]"
        />
      )}
      <div className="absolute top-0 left-0 flex flex-col items-center bg-[var(--mx-accent)] px-3.5 py-2 text-[var(--mx-accent-ink)]">
        {gig.date ? (
          <>
            <span className="mx-label text-[10px]">
              {formatMonth(gig.date)}
            </span>
            <span className="mx-display mx-num text-3xl">
              {gig.date.toLocaleDateString("en-NZ", {
                day: "2-digit",
                timeZone: "Pacific/Auckland",
              })}
            </span>
          </>
        ) : (
          <span className="mx-label py-2 text-[11px]">TBA</span>
        )}
      </div>
      <div className="flex items-end justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="mx-display truncate text-xl">{gig.headline}</p>
          <p className="mt-2 truncate text-[13px] text-white/60">
            {gig.venue}
            {gig.date ? ` · ${formatTime(gig.date)}` : ""}
          </p>
        </div>
        <span className="mx-label shrink-0 rounded-full border border-white/40 px-4 py-2.5 text-[10px] transition-colors group-hover:border-white group-hover:bg-white group-hover:text-black">
          {statusLabel[gig.status]}
        </span>
      </div>
    </a>
  );
}

const cardGigs = [
  upcomingGigs[0],
  upcomingGigs[1],
  pastGigs[2],
] satisfies MockGig[];

function CardGrid({ Card }: { Card: (props: { gig: MockGig }) => ReactNode }) {
  return (
    <div className="grid gap-4 px-5 sm:grid-cols-2 md:px-10 lg:grid-cols-3 lg:gap-6">
      {cardGigs.map((g) => (
        <Card key={g.slug} gig={g} />
      ))}
    </div>
  );
}

function PastRail() {
  const railRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) =>
    railRef.current?.scrollBy({
      left: dir * railRef.current.clientWidth * 0.8,
      behavior: "smooth",
    });

  return (
    <div>
      <div className="mb-8 flex items-end justify-between gap-6 px-5 md:px-10">
        <div>
          <h3 className="mx-display text-[clamp(2.25rem,4.5vw,3.5rem)]">
            Past gigs
          </h3>
          <p className="mt-4 max-w-[48ch] text-[15px] text-white/65">
            Sixteen nights since Caged V1 in 2024. Photos and sets from each
            one.
          </p>
        </div>
        <div className="hidden gap-2 md:flex">
          <IconButton label="Scroll back" onClick={() => scroll(-1)}>
            <ChevronLeft className="size-5" />
          </IconButton>
          <IconButton label="Scroll forward" onClick={() => scroll(1)}>
            <ChevronRight className="size-5" />
          </IconButton>
        </div>
      </div>
      <div
        ref={railRef}
        className="no-scrollbar flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 md:scroll-px-10 md:px-10"
      >
        {pastGigs.map((g) => (
          <a
            key={g.slug}
            href="#"
            className="group w-[62vw] shrink-0 snap-start sm:w-[280px]"
          >
            <Media
              src={g.poster}
              alt={`${g.title} poster`}
              sizes="280px"
              className="aspect-[4/5] transition-opacity group-hover:opacity-85"
            />
            <p className="mx-display mt-4 truncate text-lg">{g.headline}</p>
            <p className="mx-label mt-2 text-[10px] text-white/55">
              {g.date
                ? `${formatDay(g.date).slice(4)} ${formatYear(g.date)}`
                : ""}{" "}
              · {g.venue}
            </p>
          </a>
        ))}
      </div>
      <div className="mt-10 flex justify-center">
        <Button variant="outline">See all 16 past gigs</Button>
      </div>
    </div>
  );
}

export function GigsSection() {
  return (
    <div className="space-y-16 pb-16">
      <div>
        <VariantTag>
          Gig browser · tabs, search, venue, list or grid, empty state
        </VariantTag>
        <GigBrowser />
      </div>
      <div>
        <VariantTag>Card A · glass plate on poster</VariantTag>
        <CardGrid Card={CardPlate} />
      </div>
      <div>
        <VariantTag>Card B · hard ticket stub</VariantTag>
        <CardGrid Card={CardStub} />
      </div>
      <div>
        <VariantTag>Card C · notch with date block</VariantTag>
        <CardGrid Card={CardNotch} />
      </div>
      <div>
        <VariantTag>Past gigs rail</VariantTag>
        <PastRail />
      </div>
    </div>
  );
}
