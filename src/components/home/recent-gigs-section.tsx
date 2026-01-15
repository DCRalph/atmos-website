"use client";

import { Loader2 } from "lucide-react";
import { PastGigHomeCard } from "./past-gig-home-card";
import { api } from "~/trpc/react";
import { orbitron } from "~/lib/fonts";
import { FeaturedGigHomeCard } from "./featured-gig-home-card";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function RecentGigsSection() {
  const { data, isLoading } = api.homeGigs.getHomeRecent.useQuery();

  const featuredGig = data?.featuredGig ?? null;
  const pastGigs = data?.pastGigs ?? [];

  return (
    <div>
      {/* <h2 className={`mb-6 sm:mb-8 text-2xl sm:text-3xl font-bold tracking-wide md:text-4xl border-b border-white/20 pb-3 sm:pb-4 ${orbitron.className}`}>
        Recent Gigs
      </h2> */}

      <div className="mb-6 sm:mb-8 flex items-end justify-between gap-4 border-b-2 border-white/10 pb-3 sm:pb-4">
        <h2 className={`text-2xl sm:text-3xl font-black uppercase tracking-tight md:text-4xl ${orbitron.className}`}>
          Recent Gigs
        </h2>
        <Link
          href="/gigs"
          className="group flex shrink-0 items-center gap-2 rounded-none border-2 border-white/30 bg-transparent px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-all hover:border-accent-muted hover:bg-accent-muted/10 hover:text-white"
        >
          View all
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 col-span-full">
            <Loader2 className="w-6 h-6 animate-spin text-white/60" />
          </div>
        ) : featuredGig ? (
          <>
            {/* Featured gig (admin-configurable) */}
            <FeaturedGigHomeCard gig={{ ...featuredGig, gigStartTime: featuredGig.gigStartTime! }} />

            {/* Remaining recent gigs */}
            {pastGigs.length > 0 ? (
              <div className="lg:col-span-3 grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-2">
                {pastGigs.map((gig: any) => (
                  <PastGigHomeCard key={gig.id} gig={{ ...gig, gigStartTime: gig.gigStartTime! }} />
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
