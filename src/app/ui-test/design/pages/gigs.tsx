"use client";

import { useState } from "react";
import { ArrowRight, Images } from "lucide-react";
import { cn } from "~/lib/utils";
import { photos } from "../fixtures";
import { Button, Media } from "../primitives";
import { PageTitle } from "./chrome";
import {
  fmtDay,
  fmtDayNum,
  fmtMonth,
  fmtShortMonth,
  fmtTime,
  fmtWeekday,
  fmtYear,
  isPast,
  isTba,
  type Gig,
} from "./gigs-data";
import {
  AdminStrip,
  CountdownTiles,
  CtaPill,
  ErrorPanel,
  GigPoster,
  GigTabsBar,
  NothingUpcoming,
  Skeleton,
  gigsListStates,
  groupBy,
  useGigsList,
} from "./gigs-parts";
import type { PageSpec } from "./types";

const dateLine = (gig: Gig) =>
  isTba(gig)
    ? "Date to be announced"
    : `${fmtDay(gig.start)} · ${fmtTime(gig.start)}`;

// ---------------------------------------------------------------------------
// A · Grid

/** Poster card with the ticket situation under it. */
function GridCard({ gig, admin }: { gig: Gig; admin: boolean }) {
  const past = isPast(gig);
  return (
    <a href="#" className="group flex flex-col">
      {admin ? <AdminStrip gig={gig} /> : null}
      <div className="relative">
        <GigPoster
          gig={gig}
          className="aspect-[4/5] transition-opacity group-hover:opacity-90"
        />
        {past && gig.media.length ? (
          <span className="mx-glass mx-label absolute right-2 bottom-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[9px]">
            <Images className="size-3.5" /> {gig.media.length} photos
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 pt-4">
        <div className="min-w-0">
          <p className="mx-display line-clamp-2 text-[clamp(1rem,1.6vw,1.25rem)] leading-[1.05]">
            {isTba(gig) ? "TBA" : gig.title}
          </p>
          <p className="mt-2 truncate text-[13px] text-white/60">
            {dateLine(gig)} · {gig.subtitle}
          </p>
        </div>
        {past ? null : <CtaPill gig={gig} className="mt-auto self-start" />}
      </div>
    </a>
  );
}

/** Wide card for the next announced gig. */
function FeaturedGig({ gig }: { gig: Gig }) {
  return (
    <a
      href="#"
      className="group grid overflow-hidden border border-white/10 md:grid-cols-[minmax(0,340px)_1fr]"
    >
      <GigPoster gig={gig} className="aspect-[4/5]" sizes="340px" />
      <div className="relative flex flex-col justify-end gap-6 overflow-hidden p-6 md:p-10">
        <Media
          src={gig.poster}
          alt=""
          sizes="60vw"
          className="absolute inset-0 scale-125 opacity-40 blur-3xl"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/20" />
        <div className="relative">
          <p className="mx-label text-[12px] text-white/75">
            {fmtDay(gig.start)} · {gig.subtitle} · Doors {fmtTime(gig.start)}
          </p>
          <h2 className="mx-display mt-4 text-[clamp(2.25rem,5vw,4.5rem)]">
            {gig.title}
          </h2>
        </div>
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <CountdownTiles target={gig.start} compact />
          <CtaPill gig={gig} size="md" />
        </div>
      </div>
    </a>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4" aria-busy>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="aspect-[4/5]" />
          <Skeleton className="h-5 w-3/4 rounded-full" />
          <Skeleton className="h-3.5 w-1/2 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function DraftGrid({ state }: { state: string }) {
  const { tab, setTab, phase, retry, admin, gigs, counts } = useGigsList(state);
  const featured =
    tab === "upcoming"
      ? gigs.find(
          (g) =>
            !isTba(g) && g.status === "PUBLISHED" && g.mode !== "AFFILIATED",
        )
      : undefined;
  const rest = gigs.filter((g) => g !== featured);

  return (
    <>
      <PageTitle
        title="Gigs"
        intro="Upcoming events and past nights from Atmos."
      />
      <div className="px-5 pb-20 md:px-10">
        <GigTabsBar
          tab={tab}
          onChange={setTab}
          counts={counts}
          className="mb-10"
        />
        {phase === "loading" ? (
          <GridSkeleton />
        ) : phase === "error" ? (
          <ErrorPanel onRetry={retry} />
        ) : gigs.length === 0 ? (
          <NothingUpcoming onPast={() => setTab("past")} />
        ) : (
          <div className="space-y-14">
            {featured ? <FeaturedGig gig={featured} /> : null}
            <div className="grid grid-cols-2 gap-x-4 gap-y-12 lg:grid-cols-4 lg:gap-x-6">
              {rest.map((g) => (
                <GridCard key={g.id} gig={g} admin={admin} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// B · Next show

/** Row in the month-grouped list. */
function ListRow({ gig, admin }: { gig: Gig; admin: boolean }) {
  return (
    <li>
      {admin ? <AdminStrip gig={gig} className="text-left" /> : null}
      <a
        href="#"
        className="group grid grid-cols-[64px_1fr_auto] items-center gap-4 border-b border-white/10 py-4 transition-colors hover:bg-white/[0.03] md:grid-cols-[72px_84px_1fr_auto] md:gap-6 md:px-3"
      >
        <GigPoster
          gig={gig}
          className="aspect-[4/5] w-16 md:w-[72px]"
          sizes="72px"
          tbaSize="text-sm"
        />
        <div className="hidden md:block">
          {isTba(gig) ? (
            <p className="mx-display text-3xl text-white/40">--</p>
          ) : (
            <>
              <p className="mx-display mx-num text-4xl">
                {fmtDayNum(gig.start)}
              </p>
              <p className="mx-label mt-1 text-[10px] text-white/55">
                {fmtWeekday(gig.start)}
              </p>
            </>
          )}
        </div>
        <div className="min-w-0">
          <p className="mx-display truncate text-lg md:text-2xl">
            {isTba(gig) ? "TBA" : gig.title}
          </p>
          <p className="mt-1.5 truncate text-[13px] text-white/60">
            <span className="md:hidden">
              {isTba(gig) ? "Date TBA" : fmtDay(gig.start)} ·{" "}
            </span>
            {gig.subtitle}
            {isTba(gig) ? "" : ` · ${fmtTime(gig.start)}`}
          </p>
        </div>
        <CtaPill gig={gig} className="max-sm:px-3" />
      </a>
    </li>
  );
}

function PastRow({ gig }: { gig: Gig }) {
  return (
    <li>
      <a
        href="#"
        className="group grid grid-cols-[48px_1fr_auto] items-center gap-4 border-b border-white/10 py-3 transition-colors hover:bg-white/[0.03] md:grid-cols-[56px_120px_1fr_auto] md:px-3"
      >
        <GigPoster
          gig={gig}
          className="aspect-[4/5] w-12 md:w-14"
          sizes="56px"
        />
        <p className="mx-label hidden text-[11px] text-white/60 md:block">
          {fmtDay(gig.start).slice(4)}
        </p>
        <div className="min-w-0">
          <p className="mx-display truncate text-base md:text-xl">
            {gig.title}
          </p>
          <p className="mt-1 truncate text-[13px] text-white/55">
            <span className="md:hidden">{fmtDay(gig.start).slice(4)} · </span>
            {gig.subtitle}
          </p>
        </div>
        {gig.media.length ? (
          <span className="mx-label flex items-center gap-1.5 text-[10px] text-white/65 group-hover:text-white">
            <Images className="size-3.5" /> {gig.media.length}
          </span>
        ) : (
          <ArrowRight className="size-4 text-white/40 group-hover:text-white" />
        )}
      </a>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div aria-busy className="space-y-0">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className="grid grid-cols-[64px_1fr] items-center gap-4 border-b border-white/10 py-4"
        >
          <Skeleton className="aspect-[4/5] w-16" />
          <div className="space-y-2.5">
            <Skeleton className="h-5 w-1/2 rounded-full" />
            <Skeleton className="h-3.5 w-1/3 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Full-bleed hero on the next show, with a glass rail of what's after. */
function NextShowHero({ gigs, phase }: { gigs: Gig[]; phase: string }) {
  const next = gigs.find((g) => !isTba(g) && g.status === "PUBLISHED");
  const then = gigs.filter((g) => g !== next).slice(0, 3);
  return (
    <section className="relative flex min-h-[680px] flex-col justify-end overflow-hidden md:min-h-[760px]">
      <Media
        src={photos.crowd}
        alt=""
        sizes="100vw"
        className="absolute inset-0"
        priority
      />
      <div className="mx-scrim-bottom absolute inset-0" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="relative grid items-end gap-8 px-5 pt-32 pb-10 md:px-10 md:pb-14 lg:grid-cols-[1fr_380px]">
        {phase === "loading" ? (
          <div className="space-y-5" aria-busy>
            <Skeleton className="h-20 w-2/3 bg-white/15" />
            <Skeleton className="h-4 w-1/3 rounded-full bg-white/15" />
            <Skeleton className="h-24 w-[380px] max-w-full rounded-xl bg-white/15" />
          </div>
        ) : next ? (
          <div>
            <h1 className="mx-display max-w-[12ch] text-[clamp(2.75rem,8vw,6.5rem)]">
              {next.title.replace(/^broderbeats\s+/i, "")}
            </h1>
            <p className="mx-label mt-5 text-[13px] text-white/80">
              {fmtDay(next.start)} · {next.subtitle} · {fmtTime(next.start)}
            </p>
            <div className="mt-8 w-fit">
              <CountdownTiles target={next.start} />
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg">Get tickets</Button>
              <Button size="lg" variant="glass">
                Line-up
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="mx-display text-[clamp(2.75rem,8vw,6.5rem)]">
              Gigs
            </h1>
            <p className="mt-4 max-w-[44ch] text-[16px] text-white/75">
              Upcoming events and past nights from Atmos.
            </p>
          </div>
        )}
        {then.length && phase === "ready" ? (
          <div className="mx-glass-dark rounded-[var(--mx-r-panel)] rounded-tl-none p-2">
            <h2 className="mx-label px-3 pt-2 pb-1 text-[11px] text-white/60">
              Then
            </h2>
            <ul>
              {then.map((g) => (
                <li key={g.id}>
                  <a
                    href="#"
                    className="group grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-xl p-2 hover:bg-white/[0.06]"
                  >
                    <GigPoster
                      gig={g}
                      className="aspect-[4/5] w-11"
                      sizes="44px"
                      tbaSize="text-[10px]"
                    />
                    <div className="min-w-0">
                      <p className="mx-display truncate text-sm">
                        {isTba(g) ? "TBA" : g.title}
                      </p>
                      <p className="mt-1 truncate text-[12px] text-white/60">
                        {isTba(g) ? "Date TBA" : fmtDay(g.start)} · {g.subtitle}
                      </p>
                    </div>
                    <ArrowRight className="size-4 text-white/50 group-hover:text-white" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DraftNextShow({ state }: { state: string }) {
  const { tab, setTab, phase, retry, admin, gigs, counts } = useGigsList(state);
  const upcomingForHero = useGigsList("upcoming").gigs;

  return (
    <>
      <NextShowHero
        gigs={state === "empty" ? [] : upcomingForHero}
        phase={phase === "error" ? "ready" : phase}
      />
      <div className="px-5 pt-14 pb-20 md:px-10">
        <GigTabsBar
          tab={tab}
          onChange={setTab}
          counts={counts}
          className="mb-8"
        />
        {phase === "loading" ? (
          <ListSkeleton />
        ) : phase === "error" ? (
          <ErrorPanel onRetry={retry} />
        ) : gigs.length === 0 ? (
          <NothingUpcoming onPast={() => setTab("past")} />
        ) : tab === "upcoming" ? (
          groupBy(gigs, (g) => (isTba(g) ? "tba" : fmtMonth(g.start))).map(
            ({ key, items }, i) => (
              <section key={`${key}-${i}`} className="mb-12 last:mb-0">
                <header className="flex items-center gap-4 border-b border-white/10 pb-4">
                  {key === "tba" ? (
                    <span className="mx-label flex h-[52px] w-14 items-center justify-center rounded-[var(--mx-r-chip)] border border-dashed border-white/30 text-[10px] text-white/70">
                      TBA
                    </span>
                  ) : (
                    <span className="flex w-14 flex-col overflow-hidden rounded-[var(--mx-r-chip)] text-center">
                      <span className="mx-label bg-[var(--mx-accent)] py-1 text-[10px] text-[var(--mx-accent-ink)]">
                        {fmtShortMonth(items[0]!.start)}
                      </span>
                      <span className="mx-label mx-num bg-white/10 py-1 text-[10px] text-white/80">
                        {fmtYear(items[0]!.start)}
                      </span>
                    </span>
                  )}
                  <h3 className="mx-display text-2xl">
                    {key === "tba" ? "Coming up" : key.split(" ")[0]}
                  </h3>
                </header>
                <ul>
                  {items.map((g) => (
                    <ListRow key={g.id} gig={g} admin={admin} />
                  ))}
                </ul>
              </section>
            ),
          )
        ) : (
          groupBy(gigs, (g) => fmtYear(g.start)).map(({ key, items }, i) => (
            <section key={`${key}-${i}`} className="mb-12 last:mb-0">
              <h3 className="mx-display mx-num mb-2 text-[clamp(2.5rem,6vw,4.5rem)] text-white/20">
                {key}
              </h3>
              <ul className="border-t border-white/10">
                {items.map((g) => (
                  <PastRow key={g.id} gig={g} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// C · Index

/** Typographic index. On desktop the hovered row's poster shows in a sticky column. */
function DraftIndex({ state }: { state: string }) {
  const { tab, setTab, phase, retry, admin, gigs, counts } = useGigsList(state);
  const [hovered, setHovered] = useState<Gig | null>(null);
  const preview = hovered ?? gigs[0];

  return (
    <div className="px-5 pb-20 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-6 pt-12 pb-8 md:pt-20">
        <h1 className="mx-display text-[clamp(3rem,11vw,9rem)] leading-[0.85]">
          Gigs
        </h1>
        <GigTabsBar
          tab={tab}
          onChange={(t) => {
            setTab(t);
            setHovered(null);
          }}
          counts={counts}
          className="border-b-0"
        />
      </div>
      {phase === "loading" ? (
        <ListSkeleton />
      ) : phase === "error" ? (
        <ErrorPanel onRetry={retry} />
      ) : gigs.length === 0 ? (
        <NothingUpcoming onPast={() => setTab("past")} />
      ) : (
        <div className="grid gap-10 lg:grid-cols-[1fr_minmax(0,340px)]">
          <ol
            className="border-t border-white/15"
            onMouseLeave={() => setHovered(null)}
          >
            {gigs.map((g) => (
              <li
                key={g.id}
                onMouseEnter={() => setHovered(g)}
                onFocus={() => setHovered(g)}
              >
                {admin ? <AdminStrip gig={g} className="text-left" /> : null}
                <a
                  href="#"
                  className={cn(
                    "group grid grid-cols-[56px_1fr] items-center gap-x-4 gap-y-3 border-b border-white/15 py-5 md:grid-cols-[150px_1fr_auto] md:gap-x-8 md:py-6",
                    preview === g && "lg:bg-white/[0.03]",
                  )}
                >
                  <GigPoster
                    gig={g}
                    className="aspect-[4/5] w-14 md:hidden"
                    sizes="56px"
                    tbaSize="text-xs"
                  />
                  <div className="hidden md:block">
                    {isTba(g) ? (
                      <p className="mx-display text-[2.5rem] text-white/30">
                        TBA
                      </p>
                    ) : (
                      <p className="mx-display mx-num flex items-baseline gap-2 text-[2.75rem] leading-none">
                        {fmtDayNum(g.start)}
                        <span className="mx-label text-[11px] text-white/55">
                          {fmtShortMonth(g.start)}
                          {tab === "upcoming" ? "" : ` ${fmtYear(g.start)}`}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="mx-display text-[clamp(1.25rem,2.8vw,2.25rem)] leading-[1] transition-colors group-hover:text-[var(--mx-accent-text)]">
                      {isTba(g) ? "To be announced" : g.title}
                    </p>
                    <p className="mt-2 text-[13px] text-white/60">
                      <span className="md:hidden">
                        {isTba(g) ? "Date TBA" : fmtDay(g.start)} ·{" "}
                      </span>
                      {g.subtitle}
                    </p>
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    {tab === "upcoming" ? (
                      <CtaPill gig={g} />
                    ) : g.media.length ? (
                      <span className="mx-label flex items-center gap-1.5 text-[10px] text-white/65">
                        <Images className="size-3.5" /> {g.media.length} photos
                      </span>
                    ) : null}
                  </div>
                </a>
              </li>
            ))}
          </ol>
          <aside className="hidden lg:block">
            <div className="sticky top-28">
              {preview ? (
                <div
                  key={preview.id}
                  className="animate-in fade-in-0 duration-200"
                >
                  <GigPoster
                    gig={preview}
                    className="aspect-[4/5]"
                    sizes="340px"
                  />
                  <p className="mx-label mt-4 text-[11px] text-white/60">
                    {dateLine(preview)}
                  </p>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

export const gigsPage: PageSpec = {
  id: "gigs",
  title: "Gigs",
  route: "/gigs",
  nav: "Gigs",
  states: gigsListStates,
  drafts: [
    {
      id: "a",
      label: "A · Grid",
      note: "Next gig featured wide with a countdown, everything else as a poster grid.",
      Component: DraftGrid,
    },
    {
      id: "b",
      label: "B · Next show",
      note: "DnB-style: full-bleed hero on the next show, then month-grouped rows. Past is grouped by year.",
      Component: DraftNextShow,
      heroUnderHeader: true,
    },
    {
      id: "c",
      label: "C · Index",
      note: "Type-led index. Hover a row to preview its poster; phones get thumbnails inline.",
      Component: DraftIndex,
    },
  ],
};
