"use client";

import { StaticBackground } from "~/components/static-background";
import { UpcomingGigCard } from "~/components/gigs/upcoming-gig-card";
import { PastGigCard } from "~/components/gigs/past-gig-card";
import { api } from "~/trpc/react";
import { Loader2 } from "lucide-react";
import { AnimatedPageHeader } from "~/components/animated-page-header";

export default function GigsPage() {
  const { data: upcomingGigs, isLoading: isLoadingUpcomingGigs } =
    api.gigs.getUpcoming.useQuery();
  const { data: pastGigs, isLoading: isLoadingPastGigs } =
    api.gigs.getPast.useQuery();

  return (
    <main className="bg-black text-white">
      <StaticBackground imageSrc="/home/atmos-46.jpg" />

      <section className="relative z-10 min-h-dvh px-4 py-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <AnimatedPageHeader
            title="ALL GIGS"
            subtitle="Upcoming events and past nights from Atmos"
          />

          {/* Upcoming Gigs */}
          <div className="mb-16 sm:mb-20">
            <h2 className="border-accent-strong mb-6 border-l-4 pl-4 text-2xl font-black tracking-wider uppercase sm:mb-8 sm:text-3xl md:text-4xl">
              Upcoming Gigs
            </h2>
            <div className="space-y-4">
              {isLoadingUpcomingGigs ? (
                <div className="flex items-center justify-center border-2 border-white/10 bg-black/80 py-12 backdrop-blur-sm">
                  <Loader2 className="text-accent-muted h-6 w-6 animate-spin" />
                </div>
              ) : upcomingGigs &&
                upcomingGigs.filter((gig) => gig.gigStartTime).length > 0 ? (
                upcomingGigs
                  .filter((gig) => gig.gigStartTime)
                  .map((gig) => (
                    <UpcomingGigCard
                      key={gig.id}
                      gig={{ ...gig, gigStartTime: gig.gigStartTime! }}
                    />
                  ))
              ) : (
                <div className="border-2 border-white/10 bg-black/80 p-8 text-center backdrop-blur-sm">
                  <p className="font-bold tracking-wider text-white/60 uppercase">
                    No upcoming gigs
                  </p>
                  <p className="mt-2 text-sm text-white/40">
                    Check back soon for new events
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Past Gigs */}
          <div>
            <h2 className="border-accent-strong mb-6 border-l-4 pl-4 text-2xl font-black tracking-wider uppercase sm:mb-8 sm:text-3xl md:text-4xl">
              Past Gigs
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {isLoadingPastGigs ? (
                <div className="col-span-full flex items-center justify-center border-2 border-white/10 bg-black/80 py-12 backdrop-blur-sm">
                  <Loader2 className="text-accent-muted h-6 w-6 animate-spin" />
                </div>
              ) : pastGigs &&
                pastGigs.filter((gig) => gig.gigStartTime).length > 0 ? (
                pastGigs
                  .filter((gig) => gig.gigStartTime)
                  .map((gig) => (
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
          </div>
        </div>
      </section>
    </main>
  );
}
