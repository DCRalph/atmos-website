"use client";

import { Loader2 } from "lucide-react";
import { UpcomingGigHomeCard } from "./upcoming-gig-home-card";
import { api } from "~/trpc/react";
import { orbitron } from "~/lib/fonts";

export function UpcomingGigsSection() {
  const { data: upcomingGigs, isLoading: isLoadingUpcomingGigs } = api.gigs.getUpcoming.useQuery();


  return (
    <div className="mb-16 sm:mb-20">
      <h2 className={`mb-6 sm:mb-8 text-2xl sm:text-3xl font-black uppercase tracking-tight md:text-4xl border-b-2 border-white/10 pb-3 sm:pb-4 ${orbitron.className}`}>
        Upcoming Gigs
      </h2>
      <div className="space-y-4">
        {isLoadingUpcomingGigs ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-white/60" />
          </div>
          // ) : upcomingGigs && upcomingGigs.filter((gig) => gig.gigStartTime).length > 0 ?
        ) : upcomingGigs && upcomingGigs.length > 0 ?
          (
            upcomingGigs
              // .filter((gig) => gig.gigStartTime)
              .map((gig) => (
                <UpcomingGigHomeCard key={gig.id} gig={gig} />
              ))
          ) : (
            <p className="text-white/60 text-center py-8">No upcoming gigs scheduled.</p>
          )}
      </div>
    </div>
  );
}
