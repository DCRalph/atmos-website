"use client";

import { Loader2 } from "lucide-react";
import { PastGigCard } from "~/components/gigs/past-gig-card";
import { api } from "~/trpc/react";
import { orbitron } from "~/lib/fonts";
import { FeaturedGigCard } from "./featured-gig-card";

export function RecentGigsSection() {
  const { data: pastGigs, isLoading: isLoadingPastGigs } = api.gigs.getPast.useQuery();

  const sortedPastGigsWithStart = (pastGigs ?? [])
    .filter((gig) => gig.gigStartTime)
    .slice()
    .sort((a, b) => b.gigStartTime!.getTime() - a.gigStartTime!.getTime());

  // Limit past gigs to 6 most recent
  const recentPastGigs = sortedPastGigsWithStart.slice(0, 6);
  const latestPastGig = recentPastGigs[0];
  const otherRecentPastGigs = recentPastGigs.slice(1);

  return (
    <div>
      <h2 className={`mb-6 sm:mb-8 text-2xl sm:text-3xl font-bold tracking-wide md:text-4xl border-b border-white/20 pb-3 sm:pb-4 ${orbitron.className}`}>
        Recent Gigs
      </h2>
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {isLoadingPastGigs ? (
          <div className="flex items-center justify-center py-8 col-span-full">
            <Loader2 className="w-6 h-6 animate-spin text-white/60" />
          </div>
        ) : latestPastGig ? (
          <>
            {/* Featured (most recent) gig */}
            <FeaturedGigCard gig={{ ...latestPastGig, gigStartTime: latestPastGig.gigStartTime! }} />

            {/* Remaining recent gigs */}
            {otherRecentPastGigs.length > 0 ? (
              <div className="lg:col-span-3 grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
                {otherRecentPastGigs.map((gig) => (
                  <PastGigCard key={gig.id} gig={{ ...gig, gigStartTime: gig.gigStartTime! }} />
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-white/60 text-center py-8 col-span-full">No past gigs available.</p>
        )}
      </div>
    </div>
  );
}
