"use client";

import { StaticBackground } from "~/components/static-background";
import { UpcomingGigCard } from "~/components/gigs/upcoming-gig-card";
import { PastGigCard } from "~/components/gigs/past-gig-card";
import { api } from "~/trpc/react";
import { Loader2 } from "lucide-react";
import { ImageCycleBackground } from "~/components/image-cycle-background";



export default function GigsPage() {
  const { data: upcomingGigs, isLoading: isLoadingUpcomingGigs } = api.gigs.getUpcoming.useQuery();
  const { data: pastGigs, isLoading: isLoadingPastGigs } = api.gigs.getPast.useQuery();
  return (
    <main className="bg-black text-white">
      <StaticBackground imageSrc="/home/atmos-46.jpg" />
      {/* <ImageCycleBackground /> */}

      <section className="relative z-10 min-h-dvh px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          {/* <div className="mb-12">
            <Link href="/" className="text-white/60 hover:text-white transition-colors">
              ← Back
            </Link>
          </div> */}

          <h1 className="mb-12 sm:mb-16 text-center text-4xl sm:text-5xl font-bold tracking-wider md:text-7xl">
            GIGS
          </h1>

          {/* Upcoming Gigs */}
          <div className="mb-16 sm:mb-20">
            <h2 className="mb-6 sm:mb-8 text-2xl sm:text-3xl font-bold tracking-wide md:text-4xl border-b border-white/20 pb-3 sm:pb-4">
              Upcoming Gigs
            </h2>
            <div className="space-y-4">
              {isLoadingUpcomingGigs ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              ) : (
                upcomingGigs?.filter((gig) => gig.gigStartTime).map((gig) => (
                  <UpcomingGigCard key={gig.id} gig={{ ...gig, gigStartTime: gig.gigStartTime! }} />
                ))
              )}



            </div>
          </div>

          {/* Past Gigs */}
          <div>
            <h2 className="mb-6 sm:mb-8 text-2xl sm:text-3xl font-bold tracking-wide md:text-4xl border-b border-white/20 pb-3 sm:pb-4">
              Past Gigs
            </h2>
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
              {isLoadingPastGigs ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              ) : (
                pastGigs?.filter((gig) => gig.gigStartTime).map((gig) => (
                  <PastGigCard key={gig.id} gig={{ ...gig, gigStartTime: gig.gigStartTime! }} />
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

