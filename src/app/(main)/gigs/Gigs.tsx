"use client";

import { StaticBackground } from "~/components/static-background";
import { PastGigCard } from "~/components/gigs/past-gig-card";
import { api } from "~/trpc/react";
import { Loader2 } from "lucide-react";
import { AnimatedPageHeader } from "~/components/animated-page-header";
import { MainPageSection } from "~/components/main-page-section";
import { useMemo } from "react";
import { orbitron } from "~/lib/fonts";

export default function GigsPage() {
  const { data: upcomingGigs, isLoading: isLoadingUpcomingGigs } =
    api.gigs.getUpcoming.useQuery();
  const { data: pastGigs, isLoading: isLoadingPastGigs } =
    api.gigs.getPast.useQuery();

  const sortedUpcoming = useMemo(() => {
    const upcoming = (upcomingGigs ?? []).filter((gig) => gig.gigStartTime);
    // Sort by start time ascending (soonest first - next upcoming gig first)
    return [...upcoming].sort((a, b) => {
      const aTime = a.gigStartTime!.getTime();
      const bTime = b.gigStartTime!.getTime();
      return aTime - bTime;
    });
  }, [upcomingGigs]);

  const sortedPast = useMemo(() => {
    const past = (pastGigs ?? []).filter((gig) => gig.gigStartTime);
    // Sort past by end time descending (most recent first)
    return [...past].sort((a, b) => {
      const aTime = (a.gigEndTime ?? a.gigStartTime!)!.getTime();
      const bTime = (b.gigEndTime ?? b.gigStartTime!)!.getTime();
      return bTime - aTime;
    });
  }, [pastGigs]);

  const isLoading = isLoadingUpcomingGigs || isLoadingPastGigs;

  return (
    <main className="min-h-content bg-black text-white">
      <StaticBackground imageSrc="/home/atmos-46.jpg" />

      <MainPageSection>
        <AnimatedPageHeader
          title="GIGS & EVENTS"
          subtitle="Upcoming events and past nights from Atmos"
        />

        <div className="mb-8 flex flex-col gap-4 border-b-2 border-white/10 pb-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between sm:pb-6">
          <div>
            <h2
              className={`text-2xl font-black tracking-tight uppercase sm:text-3xl md:text-4xl ${orbitron.className}`}
            >
              Upcoming Gigs
            </h2>
            {/* <p className="mt-2 max-w-2xl text-sm text-white/50 sm:text-base">
              Tap into the newest mixes, live captures, and community releases.
            </p> */}
          </div>
          {/* <div className="flex items-center gap-3 text-xs font-bold tracking-wider text-white/50 uppercase">
            {sortedUpcoming.length > 0 && (
              <span className="text-white/70">{sortedUpcoming.length} items</span>
            )}
          </div> */}
        </div>

        {/* Upcoming Gigs */}
        {sortedUpcoming.length > 0 && (
          <div className="mb-16 sm:mb-20">
            {/* <h2 className="border-accent-strong mb-6 border-l-4 pl-4 text-2xl font-black tracking-wider uppercase sm:mb-8 sm:text-3xl md:text-4xl">
              Upcoming Gigs
            </h2>
            <div className="flex items-center gap-3 text-xs font-bold tracking-wider text-white/50 uppercase">
              {sortedUpcoming.length > 0 && (
                <span className="text-white/70">{sortedUpcoming.length} items</span>
              )}
            </div> */}
            <div className="grid grid-cols-2 gap-2 md:gap-4 lg:grid-cols-3">
              {sortedUpcoming.map((gig) => (
                <PastGigCard
                  key={gig.id}
                  gig={{ ...gig, gigStartTime: gig.gigStartTime! }}
                  upcomming
                />
              ))}
            </div>
          </div>
        )}

        {/* Past Gigs */}

        <div className="mb-8 flex flex-col gap-4 border-b-2 border-white/10 pb-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between sm:pb-6">
          <div>
            <h2
              className={`text-2xl font-black tracking-tight uppercase sm:text-3xl md:text-4xl ${orbitron.className}`}
            >
              Past Gigs
            </h2>
            {/* <p className="mt-2 max-w-2xl text-sm text-white/50 sm:text-base">
              Tap into the newest mixes, live captures, and community releases.
            </p> */}
          </div>
          {/* <div className="flex items-center gap-3 text-xs font-bold tracking-wider text-white/50 uppercase">
            {sortedPast.length > 0 && (
              <span className="text-white/70">{sortedPast.length} items</span>
            )}
          </div> */}
        </div>


        {/* <h2 className="border-accent-strong mb-6 border-l-4 pl-4 text-2xl font-black tracking-wider uppercase sm:mb-8 sm:text-3xl md:text-4xl">
            Past Gigs
          </h2> */}
        <div className="grid grid-cols-2 gap-2 md:gap-4 lg:grid-cols-3">
          {isLoading ? (
            <div className="col-span-full flex items-center justify-center border-2 border-white/10 bg-black/80 py-12 backdrop-blur-sm">
              <Loader2 className="text-accent-muted h-6 w-6 animate-spin" />
            </div>
          ) : sortedPast.length > 0 ? (
            sortedPast.map((gig) => (
              <PastGigCard
                key={gig.id}
                gig={{ ...gig, gigStartTime: gig.gigStartTime! }}
              />
            ))
          ) : (
            <div className="col-span-full border-2 border-white/10 bg-black/80 p-8 text-center backdrop-blur-sm">
              <p className="font-bold tracking-wider text-white/60 uppercase">
                No past gigs yet
              </p>
            </div>
          )}
        </div>
      </MainPageSection>
    </main>
  );
}
