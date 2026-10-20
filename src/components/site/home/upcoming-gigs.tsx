"use client";

import Link from "next/link";
import { api, type RouterOutputs } from "~/trpc/react";
import { gigPath } from "~/lib/gig-url";
import { gigOffSiteNotice } from "~/lib/gig-visibility";
import { formatEventDate, formatEventTime } from "~/lib/ticketing/dates";
import { AtmosLogo, Skeleton } from "../ui";
import { GigPoster, SectionError, SectionHeader } from "./parts";
import { OnNowChip, nightOf, useIsOnNow } from "../on-now";
import { useSite } from "../site-provider";

type UpcomingGig = RouterOutputs["gigs"]["getUpcoming"][number];

const gridClass =
  "mx-auto grid max-w-[824px] grid-cols-2 gap-x-4 gap-y-8 md:gap-x-7";

/** Poster pairs, padded with display-only TBA cards after filtering hidden gigs. */
export function UpcomingGigs() {
  const upcoming = api.gigs.getUpcoming.useQuery();
  const { data: user } = api.user.me.useQuery();
  const { showHiddenEvents } = useSite();
  const hideHiddenEvents =
    user?.effectivePermissions.includes("ADMIN") && !showHiddenEvents;
  const gigs = (upcoming.data ?? []).filter(
    (gig) => !hideHiddenEvents || gigOffSiteNotice(gig) === null,
  );
  const placeholders = Math.max(2 - gigs.length, gigs.length % 2);

  return (
    <section
      aria-labelledby="home-upcoming"
      className="scroll-mt-16 px-5 pt-14 pb-16 md:scroll-mt-20 md:px-10 md:pt-16 md:pb-20"
    >
      <SectionHeader
        id="home-upcoming"
        title="Upcoming"
        href="/gigs"
        linkLabel="All gigs"
      />
      {upcoming.isPending ? (
        <GridSkeleton />
      ) : upcoming.isError ? (
        <SectionError what="gigs" onRetry={() => void upcoming.refetch()} />
      ) : (
        <ul className={gridClass}>
          {gigs.map((gig) => (
            <GigCard key={gig.id} gig={gig} />
          ))}
          {Array.from({ length: placeholders }, (_, i) => (
            <TbaCard key={`tba-${i}`} />
          ))}
        </ul>
      )}
    </section>
  );
}

function GigCard({ gig }: { gig: UpcomingGig }) {
  const onNow = useIsOnNow(gig.isTba ? null : nightOf(gig));
  const notice = gigOffSiteNotice(gig);

  return (
    <li className="min-w-0">
      {notice ? (
        <p className="t-label bg-site-warn mb-3 px-3 py-1.5 text-[9px] text-black">
          {notice}
        </p>
      ) : null}
      <Link
        href={gigPath(gig)}
        aria-label={
          gig.isTba ? "Upcoming gig, details to be announced" : gig.title
        }
        className="group block"
      >
        <div className="relative">
          <GigPoster
            gig={gig}
            sizes="(min-width: 904px) 398px, calc((100vw - 56px) / 2)"
            className="aspect-[4/5] transition-opacity group-hover:opacity-85"
            fit="contain"
            tbaClassName="text-[clamp(1.75rem,5vw,3.5rem)] text-white/70"
          />
          {onNow ? <OnNowChip className="absolute bottom-3 left-3" /> : null}
        </div>
        <p className="mt-3 text-[12px] text-white md:mt-4 md:text-[17px]">
          {gig.isTba ? (
            "Date & time TBA"
          ) : (
            <>
              {formatEventDate(gig.gigStartTime)} ·{" "}
              {formatEventTime(gig.gigStartTime)}
            </>
          )}
        </p>
        <p className="mt-1 text-[12px] break-words text-white/65 md:text-base">
          {gig.isTba ? "Location TBA" : gig.subtitle || "Location TBA"}
        </p>
      </Link>
    </li>
  );
}

/** A visual placeholder, with no invented event or link behind it. */
function TbaCard() {
  return (
    <li className="min-w-0">
      <div className="relative flex aspect-[4/5] items-center justify-center border border-white/10 bg-white/[0.04]">
        <AtmosLogo className="absolute top-4 left-4 w-1/5 opacity-20 md:top-6 md:left-6" />
        <p className="t-display text-[clamp(1.75rem,5vw,3.5rem)] text-white/70">
          TBA
        </p>
      </div>
      <p className="mt-3 text-[12px] text-white md:mt-4 md:text-[17px]">
        Date &amp; time TBA
      </p>
      <p className="mt-1 text-[12px] text-white/65 md:text-base">
        Location TBA
      </p>
    </li>
  );
}

function GridSkeleton() {
  return (
    <div aria-busy aria-label="Loading upcoming gigs" className={gridClass}>
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-[4/5]" />
          <Skeleton className="mt-4 h-4 w-3/4" />
          <Skeleton className="mt-2 h-4 w-1/3" />
        </div>
      ))}
    </div>
  );
}
