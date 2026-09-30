"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { gigPath } from "~/lib/gig-url";
import { gigOffSiteNotice } from "~/lib/gig-visibility";
import { formatEventDate, formatEventTime } from "~/lib/ticketing/dates";
import { Skeleton } from "../ui";
import {
  GigPoster,
  SectionEmpty,
  SectionError,
  SectionHeader,
  nzDate,
} from "./parts";
import { OnNowChip, nightOf, useIsOnNow } from "../on-now";

type UpcomingGig = RouterOutputs["gigs"]["getUpcoming"][number];

const isTba = (gig: UpcomingGig) => gig.mode === "TO_BE_ANNOUNCED";

/** Consecutive gigs sharing a month, in server order (dated first, TBA last). */
function groupByMonth(gigs: UpcomingGig[]) {
  const groups: { key: string; gigs: UpcomingGig[] }[] = [];
  for (const gig of gigs) {
    const key = isTba(gig)
      ? "tba"
      : `${nzDate.month.format(gig.gigStartTime)} ${nzDate.year.format(gig.gigStartTime)}`;
    const last = groups.at(-1);
    if (last?.key === key) last.gigs.push(gig);
    else groups.push({ key, gigs: [gig] });
  }
  return groups;
}

/** Every upcoming gig as month-grouped rows. Admins also see drafts, flagged. */
export function UpcomingGigs() {
  const upcoming = api.gigs.getUpcoming.useQuery();

  return (
    <section
      aria-labelledby="home-upcoming"
      className="px-5 pt-14 pb-16 md:px-10 md:pt-20 md:pb-24"
    >
      <SectionHeader
        id="home-upcoming"
        title="Upcoming"
        href="/gigs"
        linkLabel="All gigs"
      />
      {upcoming.isPending ? (
        <ListSkeleton />
      ) : upcoming.isError ? (
        <SectionError what="gigs" onRetry={() => void upcoming.refetch()} />
      ) : upcoming.data.length === 0 ? (
        <SectionEmpty>
          Nothing announced yet.{" "}
          <Link
            href="/gigs"
            className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
          >
            See past gigs
          </Link>
        </SectionEmpty>
      ) : (
        <div className="space-y-12">
          {groupByMonth(upcoming.data).map(({ key, gigs }) => (
            <MonthGroup key={key} gigs={gigs} tba={key === "tba"} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Month header (accent month over year) and its rows. */
function MonthGroup({ gigs, tba }: { gigs: UpcomingGig[]; tba: boolean }) {
  const first = gigs[0];
  if (!first) return null;
  return (
    <div>
      <header className="flex items-center gap-4 border-b border-white/10 pb-4">
        {tba ? (
          <span className="t-label flex h-[52px] w-14 items-center justify-center rounded-[var(--site-r-chip)] border border-dashed border-white/30 text-[10px] text-white/70">
            TBA
          </span>
        ) : (
          <span className="flex w-14 flex-col overflow-hidden rounded-[var(--site-r-chip)] text-center">
            <span className="t-label bg-[var(--site-accent)] py-1.5 text-[10px] text-[var(--site-accent-ink)]">
              {nzDate.shortMonth.format(first.gigStartTime)}
            </span>
            <span className="t-label bg-white/10 py-1.5 text-[10px] text-white/80 tabular-nums">
              {nzDate.year.format(first.gigStartTime)}
            </span>
          </span>
        )}
        <h3 className="t-display text-2xl">
          {tba ? "To be announced" : nzDate.month.format(first.gigStartTime)}
        </h3>
      </header>
      <ul>
        {gigs.map((gig) => (
          <GigRow key={gig.id} gig={gig} />
        ))}
      </ul>
    </div>
  );
}

function GigRow({ gig }: { gig: UpcomingGig }) {
  const tba = isTba(gig);
  const onNow = useIsOnNow(tba ? null : nightOf(gig));
  const notice = gigOffSiteNotice(gig);
  const meta = tba
    ? ["Date to be announced"]
    : [gig.subtitle, formatEventTime(gig.gigStartTime)];

  return (
    <li>
      {notice ? (
        <p className="t-label mt-3 bg-[var(--site-warn)] px-3 py-1.5 text-[9px] text-black">
          {notice}
        </p>
      ) : null}
      <Link
        href={gigPath(gig)}
        className="group grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-4 border-b border-white/10 py-4 transition-colors hover:bg-white/[0.03] md:grid-cols-[72px_84px_minmax(0,1fr)_auto] md:gap-6 md:px-3"
      >
        <GigPoster
          gig={gig}
          sizes="72px"
          className="aspect-[4/5] w-16 md:w-[72px]"
        />
        <div className="hidden md:block">
          {tba ? (
            <p className="t-display text-3xl text-white/40">--</p>
          ) : (
            <>
              <p className="t-display text-4xl tabular-nums">
                {nzDate.day.format(gig.gigStartTime)}
              </p>
              <p className="t-label mt-1.5 text-[10px] text-white/55">
                {nzDate.weekday.format(gig.gigStartTime)}
              </p>
            </>
          )}
        </div>
        <div className="min-w-0">
          {onNow ? <OnNowChip className="mb-2" /> : null}
          <p className="t-display line-clamp-2 text-lg break-words transition-colors group-hover:text-[var(--site-accent-text)] md:text-2xl">
            {tba ? "TBA" : gig.title}
          </p>
          <p className="mt-1.5 truncate text-[13px] text-white/60">
            {tba ? null : (
              <span className="md:hidden">
                {formatEventDate(gig.gigStartTime)} ·{" "}
              </span>
            )}
            {meta.filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className="flex size-10 items-center justify-center rounded-full border border-white/20 text-white/70 transition-colors group-hover:border-white group-hover:text-white">
          <ArrowRight className="size-4" />
        </span>
      </Link>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div aria-busy>
      <div className="flex items-center gap-4 border-b border-white/10 pb-4">
        <Skeleton className="h-[52px] w-14 rounded-[var(--site-r-chip)]" />
        <Skeleton className="h-6 w-40 rounded-full" />
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          className="grid grid-cols-[64px_1fr] items-center gap-4 border-b border-white/10 py-4 md:grid-cols-[72px_1fr] md:gap-6 md:px-3"
        >
          <Skeleton className="aspect-[4/5] w-16 md:w-[72px]" />
          <div className="space-y-2.5">
            <Skeleton className="h-5 w-1/2 rounded-full" />
            <Skeleton className="h-3.5 w-1/3 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
