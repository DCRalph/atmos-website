"use client";

import { StaticBackground } from "~/components/static-background";
import { PastGigCard } from "~/components/gigs/past-gig-card";
import { api } from "~/trpc/react";
import { Loader2 } from "lucide-react";
import { AnimatedPageHeader } from "~/components/animated-page-header";
import { MainPageSection } from "~/components/main-page-section";
import { useMemo } from "react";
import { isGigPast } from "~/lib/date-utils";

export default function GigsPage() {
  const { data: upcomingGigs, isLoading: isLoadingUpcomingGigs } =
    api.gigs.getUpcoming.useQuery();
  const { data: pastGigs, isLoading: isLoadingPastGigs } =
    api.gigs.getPast.useQuery();

  const allGigs = useMemo(() => {
    const upcoming = (upcomingGigs ?? []).filter((gig) => gig.gigStartTime);
    const past = (pastGigs ?? []).filter((gig) => gig.gigStartTime);

    // Sort upcoming by start time ascending (soonest first)
    const sortedUpcoming = [...upcoming].sort((a, b) => {
      const aTime = a.gigStartTime!.getTime();
      const bTime = b.gigStartTime!.getTime();
      return aTime - bTime;
    });

    // Sort past by end time descending (most recent first)
    const sortedPast = [...past].sort((a, b) => {
      const aTime = (a.gigEndTime ?? a.gigStartTime!)!.getTime();
      const bTime = (b.gigEndTime ?? b.gigStartTime!)!.getTime();
      return bTime - aTime;
    });

    return [...sortedUpcoming, ...sortedPast];
  }, [upcomingGigs, pastGigs]);

  const isLoading = isLoadingUpcomingGigs || isLoadingPastGigs;

  return (
    <main className="min-h-content bg-black text-white">
      <StaticBackground imageSrc="/home/atmos-46.jpg" />

      <MainPageSection>
        <AnimatedPageHeader
          title="GIGS & EVENTS"
          subtitle="Upcoming events and past nights from Atmos"
        />

        <div>
          <div className="grid grid-cols-2 gap-2 md:gap-4 lg:grid-cols-3">
            {isLoading ? (
              <div className="col-span-full flex items-center justify-center border-2 border-white/10 bg-black/80 py-12 backdrop-blur-sm">
                <Loader2 className="text-accent-muted h-6 w-6 animate-spin" />
              </div>
            ) : allGigs.length > 0 ? (
              allGigs.map((gig) => (
                <PastGigCard
                  key={gig.id}
                  gig={{ ...gig, gigStartTime: gig.gigStartTime! }}
                />
              ))
            ) : (
              <div className="col-span-full border-2 border-white/10 bg-black/80 p-8 text-center backdrop-blur-sm">
                <p className="font-bold tracking-wider text-white/60 uppercase">
                  No gigs available
                </p>
                <p className="mt-2 text-sm text-white/40">
                  Check back soon for new events
                </p>
              </div>
            )}
          </div>
        </div>
      </MainPageSection>
    </main>
  );
}
