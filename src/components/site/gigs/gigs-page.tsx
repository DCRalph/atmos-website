"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarX2, Images } from "lucide-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { gigPath } from "~/lib/gig-url";
import { NewsletterForm } from "../newsletter-form";
import { Button, Media, Skeleton, buttonVariants } from "../ui";
import {
  AdminStrip,
  CtaPill,
  DateChip,
  GigLink,
  GigPoster,
  fmtDay,
  fmtDayNum,
  fmtMonth,
  fmtTime,
  fmtWeekday,
  fmtYear,
  gigTitle,
  groupConsecutive,
  isTba,
  ticketCta,
  type ListGig,
  type PublicTicketEvent,
} from "./gig-parts";
import { GigCountdown, OnNowChip, nightOf, useIsOnNow } from "../on-now";

const TABS = [
  { id: "upcoming", label: "Upcoming", empty: "No upcoming gigs" },
  { id: "past", label: "Past", empty: "No past gigs yet" },
  {
    id: "affiliated",
    label: "Past affiliated",
    empty: "No affiliated gigs yet",
  },
] as const;
type TabId = (typeof TABS)[number]["id"];

/** Upcoming row: poster, date, title and venue, ticket status. */
function UpcomingRow({
  gig,
  event,
}: {
  gig: ListGig;
  event: PublicTicketEvent | undefined;
}) {
  const cta = ticketCta(gig, event);
  const tba = isTba(gig);
  const onNow = useIsOnNow(tba ? null : nightOf(gig));
  return (
    <li>
      <AdminStrip gig={gig} className="text-left" />
      <GigLink
        gig={gig}
        className="group grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-4 border-b border-white/10 py-4 transition-colors hover:bg-white/[0.03] md:grid-cols-[72px_84px_minmax(0,1fr)_auto] md:gap-6 md:px-3"
      >
        <GigPoster
          gig={gig}
          className="aspect-[4/5] w-16 md:w-[72px]"
          sizes="72px"
          tbaSize="text-sm"
          muted={cta.tone === "muted"}
        />
        <div className="hidden md:block">
          {tba ? (
            <p className="t-display text-3xl text-white/40">--</p>
          ) : (
            <>
              <p className="t-display text-4xl tabular-nums">
                {fmtDayNum(gig.gigStartTime)}
              </p>
              <p className="t-label mt-1 text-[10px] text-white/55">
                {fmtWeekday(gig.gigStartTime)}
              </p>
            </>
          )}
        </div>
        <div className="min-w-0">
          {onNow ? <OnNowChip className="mb-2" /> : null}
          <p className="t-display line-clamp-2 text-base leading-[1.05] normal-case md:text-2xl">
            {gigTitle(gig)}
          </p>
          <p className="mt-1.5 truncate text-[13px] text-white/60">
            <span className="md:hidden">
              {tba ? "Date TBA" : fmtDay(gig.gigStartTime)} ·{" "}
            </span>
            {gig.subtitle}
            {tba ? "" : ` · ${fmtTime(gig.gigStartTime)}`}
          </p>
          <CtaPill cta={cta} className="mt-3 sm:hidden" />
        </div>
        <CtaPill cta={cta} className="max-sm:hidden" />
      </GigLink>
    </li>
  );
}

/** Past row: compact, with a photo count when the gig has a gallery. */
function PastRow({ gig }: { gig: ListGig }) {
  const photos = gig.media.filter((m) => m.type === "photo").length;
  return (
    <li>
      <GigLink
        gig={gig}
        className="group grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-4 border-b border-white/10 py-3 transition-colors hover:bg-white/[0.03] md:grid-cols-[56px_120px_minmax(0,1fr)_auto] md:px-3"
      >
        <GigPoster
          gig={gig}
          className="aspect-[4/5] w-12 md:w-14"
          sizes="56px"
        />
        <p className="t-label hidden text-[11px] text-white/60 md:block">
          {fmtDay(gig.gigStartTime).slice(4)}
        </p>
        <div className="min-w-0">
          <p className="t-display line-clamp-2 text-sm leading-[1.1] normal-case md:text-lg">
            {gig.title}
          </p>
          <p className="mt-1 truncate text-[13px] text-white/55">
            <span className="md:hidden">
              {fmtDay(gig.gigStartTime).slice(4)} ·{" "}
            </span>
            {gig.subtitle}
          </p>
        </div>
        {photos ? (
          <span className="t-label flex items-center gap-1.5 text-[10px] text-white/65 group-hover:text-white">
            <Images className="size-3.5" /> {photos}
          </span>
        ) : (
          <ArrowRight className="size-4 text-white/40 group-hover:text-white" />
        )}
      </GigLink>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div aria-busy>
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

function ErrorPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 border border-white/10 px-6 py-16 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full border border-[var(--site-danger)]/50">
        <AlertTriangle className="size-5 text-[var(--site-danger-text)]" />
      </span>
      <p className="t-display text-2xl">We couldn&apos;t load gigs</p>
      <p className="max-w-[36ch] text-[14px] text-white/60">
        Check your connection, then try again.
      </p>
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/** Empty upcoming list: a signup and a way into the archive instead of a dead end. */
function NothingUpcoming({ onPast }: { onPast: () => void }) {
  return (
    <div className="flex flex-col items-center gap-5 border border-white/10 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full border border-white/15">
        <CalendarX2 className="size-5 text-white/60" />
      </span>
      <p className="t-display text-[clamp(1.5rem,4vw,2.5rem)]">
        No upcoming gigs
      </p>
      <p className="max-w-[40ch] text-[15px] text-white/60">
        We&apos;re booking the next one. Get told first, with presale codes
        before tickets go public.
      </p>
      <NewsletterForm cta="Notify me" className="w-full max-w-[440px]" />
      <button
        type="button"
        onClick={onPast}
        className="t-label text-[11px] text-white/65 underline-offset-4 hover:text-white hover:underline"
      >
        See past gigs
      </button>
    </div>
  );
}

/** Full-bleed hero on the next announced gig, with a glass rail of what's after. */
function NextShowHero({
  gigs,
  events,
  loading,
}: {
  gigs: ListGig[];
  events: Map<string, PublicTicketEvent>;
  loading: boolean;
}) {
  const next = gigs.find(
    (g) => !isTba(g) && g.status === "PUBLISHED" && !g.isAffiliated,
  );
  const then = gigs.filter((g) => g !== next).slice(0, 3);
  const cta = next ? ticketCta(next, events.get(next.id)) : null;

  return (
    <section className="relative flex min-h-[640px] flex-col justify-end overflow-hidden md:min-h-[740px]">
      <Media
        src="/home/atmos-46.jpg"
        alt=""
        sizes="100vw"
        className="absolute inset-0"
        priority
      />
      <div className="scrim-bottom absolute inset-0" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="relative grid grid-cols-1 items-end gap-8 px-5 pt-32 pb-10 md:px-10 md:pb-14 lg:grid-cols-[minmax(0,1fr)_380px]">
        {loading ? (
          <div className="space-y-5" aria-busy>
            <Skeleton className="h-20 w-2/3 bg-white/15" />
            <Skeleton className="h-4 w-1/3 rounded-full bg-white/15" />
            <Skeleton className="h-24 w-[380px] max-w-full rounded-xl bg-white/15" />
          </div>
        ) : next ? (
          <div className="min-w-0">
            <h1 className="t-display max-w-[14ch] text-[clamp(1.75rem,6.4vw,5.5rem)] [overflow-wrap:anywhere] normal-case">
              <Link
                href={gigPath(next)}
                className="hover:text-[var(--site-accent-text)]"
              >
                {next.title}
              </Link>
            </h1>
            <p className="t-label mt-5 text-[12px] text-white/80 md:text-[13px]">
              {fmtDay(next.gigStartTime)} · {next.subtitle} ·{" "}
              {fmtTime(next.gigStartTime)}
            </p>
            <div className="mt-8 w-fit max-w-full">
              <GigCountdown night={nightOf(next)} />
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              {cta?.href ? (
                <Link
                  href={cta.href}
                  target={cta.tone === "external" ? "_blank" : undefined}
                  rel={
                    cta.tone === "external" ? "noopener noreferrer" : undefined
                  }
                  className={buttonVariants({ size: "lg" })}
                >
                  {cta.tone === "buy" ? "Get tickets" : cta.label}
                </Link>
              ) : null}
              <Link
                href={gigPath(next)}
                className={buttonVariants({ size: "lg", variant: "glass" })}
              >
                Details
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="t-heading text-[clamp(2.75rem,8vw,6.5rem)]">Gigs</h1>
            <p className="mt-4 max-w-[44ch] text-[16px] text-white/75">
              Upcoming events and past nights from Atmos.
            </p>
          </div>
        )}
        {!loading && next && then.length ? (
          <div className="glass-dark rounded-[var(--site-r-panel)] rounded-tl-none p-2">
            <h2 className="t-label px-3 pt-2 pb-1 text-[11px] text-white/60">
              Then
            </h2>
            <ul>
              {then.map((g) => (
                <li key={g.id}>
                  <GigLink
                    gig={g}
                    className="group grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl p-2 hover:bg-white/[0.06]"
                  >
                    <GigPoster
                      gig={g}
                      className="aspect-[4/5] w-11"
                      sizes="44px"
                      tbaSize="text-[10px]"
                    />
                    <div className="min-w-0">
                      <p className="t-display truncate text-sm normal-case">
                        {gigTitle(g)}
                      </p>
                      <p className="mt-1 truncate text-[12px] text-white/60">
                        {isTba(g) ? "Date TBA" : fmtDay(g.gigStartTime)} ·{" "}
                        {g.subtitle}
                      </p>
                    </div>
                    <ArrowRight className="size-4 text-white/50 group-hover:text-white" />
                  </GigLink>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The gigs page: next-show hero, then Upcoming / Past / Past affiliated.
 *
 * All three lists load together so tabs switch instantly and the counts are
 * exact (none is paginated). Lists keep the server's order: unannounced gigs
 * after announced ones, past gigs as an admin arranged them.
 */
export function GigsPage() {
  const [tab, setTab] = useState<TabId>("upcoming");
  const upcoming = api.gigs.getUpcoming.useQuery();
  const past = api.gigs.getPast.useQuery({ kind: "OURS" });
  const affiliated = api.gigs.getPast.useQuery({ kind: "AFFILIATED" });
  // One query for every on-site ticket event, matched to gigs by id.
  const ticketEvents = api.ticketEvents.upcoming.useQuery();

  const events = useMemo(() => {
    const map = new Map<string, PublicTicketEvent>();
    for (const e of ticketEvents.data ?? []) if (e.gig) map.set(e.gig.id, e);
    return map;
  }, [ticketEvents.data]);

  const queries = { upcoming, past, affiliated };
  const active = queries[tab];
  const gigs = active.data ?? [];

  return (
    <>
      <NextShowHero
        gigs={upcoming.data ?? []}
        events={events}
        loading={upcoming.isPending}
      />
      <div className="px-5 pt-14 pb-20 md:px-10">
        <div
          role="tablist"
          aria-label="Gigs"
          className="no-scrollbar mb-8 flex gap-7 overflow-x-auto border-b border-white/10"
        >
          {TABS.map((t) => {
            const count = queries[t.id].data?.length;
            return (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "t-label -mb-px flex shrink-0 items-baseline gap-2 border-b-2 pb-4 text-[11px] transition-colors md:text-[12px]",
                  tab === t.id
                    ? "border-[var(--site-accent)] text-white"
                    : "border-transparent text-white/50 hover:text-white",
                )}
              >
                {t.label}
                {count !== undefined ? (
                  <span className="text-[10px] text-white/45 tabular-nums">
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {active.isPending ? (
          <ListSkeleton />
        ) : active.isError ? (
          <ErrorPanel onRetry={() => void active.refetch()} />
        ) : gigs.length === 0 ? (
          tab === "upcoming" ? (
            <NothingUpcoming onPast={() => setTab("past")} />
          ) : (
            <p className="border border-white/10 px-6 py-12 text-center text-[15px] text-white/60">
              {TABS.find((t) => t.id === tab)?.empty}
            </p>
          )
        ) : tab === "upcoming" ? (
          groupConsecutive(gigs, (g) =>
            isTba(g) ? "tba" : fmtMonth(g.gigStartTime),
          ).map(({ key, items }, i) => (
            <section key={`${key}-${i}`} className="mb-12 last:mb-0">
              <header className="flex items-center gap-4 border-b border-white/10 pb-4">
                {key === "tba" ? (
                  <span className="t-label flex h-[52px] w-14 items-center justify-center rounded-[var(--site-r-chip)] border border-dashed border-white/30 text-[10px] text-white/70">
                    TBA
                  </span>
                ) : (
                  <DateChip date={items[0]!.gigStartTime} />
                )}
                <h2 className="t-display text-2xl">
                  {key === "tba" ? "Coming up" : key.split(" ")[0]}
                </h2>
              </header>
              <ul>
                {items.map((g) => (
                  <UpcomingRow key={g.id} gig={g} event={events.get(g.id)} />
                ))}
              </ul>
            </section>
          ))
        ) : (
          groupConsecutive(gigs, (g) => fmtYear(g.gigStartTime)).map(
            ({ key, items }, i) => (
              <section key={`${key}-${i}`} className="mb-12 last:mb-0">
                <h2 className="t-display mb-2 text-[clamp(2.5rem,6vw,4.5rem)] text-white/20 tabular-nums">
                  {key}
                </h2>
                <ul className="border-t border-white/10">
                  {items.map((g) => (
                    <PastRow key={g.id} gig={g} />
                  ))}
                </ul>
              </section>
            ),
          )
        )}
      </div>
    </>
  );
}
