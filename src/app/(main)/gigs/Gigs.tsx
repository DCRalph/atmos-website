"use client"

import { StaticBackground } from "~/components/static-background"
import { UpcomingGigCard } from "~/components/gigs/upcoming-gig-card"
import { PastGigCard } from "~/components/gigs/past-gig-card"
import { api } from "~/trpc/react"
import { Loader2 } from "lucide-react"
import { AnimatedPageHeader } from "~/components/animated-page-header"

export default function GigsPage() {
  const { data: upcomingGigs, isLoading: isLoadingUpcomingGigs } = api.gigs.getUpcoming.useQuery()
  const { data: pastGigs, isLoading: isLoadingPastGigs } = api.gigs.getPast.useQuery()

  return (
    <main className="bg-black text-white">
      <StaticBackground imageSrc="/home/atmos-46.jpg" />

      <section className="relative z-10 min-h-dvh px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <AnimatedPageHeader
            title="ALL GIGS"
            subtitle="Upcoming events and past nights from Atmos"
          />

          {/* Upcoming Gigs */}
          <div className="mb-16 sm:mb-20">
            <h2 className="mb-6 sm:mb-8 text-2xl sm:text-3xl font-black tracking-wider uppercase md:text-4xl border-l-4 border-accent-strong pl-4">
              Upcoming Gigs
            </h2>
            <div className="space-y-4">
              {isLoadingUpcomingGigs ? (
                <div className="flex items-center justify-center py-12 border-2 border-white/10 bg-black/80 backdrop-blur-sm">
                  <Loader2 className="w-6 h-6 animate-spin text-accent-muted" />
                </div>
              ) : upcomingGigs && upcomingGigs.filter((gig) => gig.gigStartTime).length > 0 ? (
                upcomingGigs.filter((gig) => gig.gigStartTime).map((gig) => (
                  <UpcomingGigCard key={gig.id} gig={{ ...gig, gigStartTime: gig.gigStartTime! }} />
                ))
              ) : (
                <div className="border-2 border-white/10 bg-black/80 backdrop-blur-sm p-8 text-center">
                  <p className="text-white/60 font-bold uppercase tracking-wider">No upcoming gigs</p>
                  <p className="text-white/40 text-sm mt-2">Check back soon for new events</p>
                </div>
              )}
            </div>
          </div>

          {/* Past Gigs */}
          <div>
            <h2 className="mb-6 sm:mb-8 text-2xl sm:text-3xl font-black tracking-wider uppercase md:text-4xl border-l-4 border-accent-strong pl-4">
              Past Gigs
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {isLoadingPastGigs ? (
                <div className="flex items-center justify-center py-12 border-2 border-white/10 bg-black/80 backdrop-blur-sm col-span-full">
                  <Loader2 className="w-6 h-6 animate-spin text-accent-muted" />
                </div>
              ) : pastGigs && pastGigs.filter((gig) => gig.gigStartTime).length > 0 ? (
                pastGigs.filter((gig) => gig.gigStartTime).map((gig) => (
                  <PastGigCard key={gig.id} gig={{ ...gig, gigStartTime: gig.gigStartTime! }} />
                ))
              ) : (
                <div className="border-2 border-white/10 bg-black/80 backdrop-blur-sm p-8 text-center col-span-full">
                  <p className="text-white/60 font-bold uppercase tracking-wider">No past gigs yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
