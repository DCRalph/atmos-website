"use client";

import { Loader2 } from "lucide-react";
import { PastGigHomeCard } from "./past-gig-home-card";
import { api } from "~/trpc/react";
import { orbitron } from "~/lib/fonts";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";

export function RecentGigsSection() {
  const { data, isLoading } = api.homeGigs.getHomeRecent.useQuery();

  const featuredGig = data?.featuredGig ?? null;
  const pastGigs = data?.pastGigs ?? [];

  return (
    <div>
      {/* <h2 className={`mb-6 sm:mb-8 text-2xl sm:text-3xl font-bold tracking-wide md:text-4xl border-b border-white/20 pb-3 sm:pb-4 ${orbitron.className}`}>
        Recent Gigs
      </h2> */}

      <div className="mb-6 flex items-end justify-between gap-4 border-b-2 border-white/10 pb-3 sm:mb-8 sm:pb-4">
        <motion.h2
          className={`text-2xl font-black tracking-tight uppercase sm:text-3xl md:text-4xl ${orbitron.className}`}

          initial={{ opacity: 0, x: "100%" }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          Recent Gigs
        </motion.h2>
        <Link
          href="/gigs"
          className="group hover:border-accent-muted hover:bg-accent-muted/10 flex shrink-0 items-center gap-2 rounded-none border-2 border-white/30 bg-transparent px-4 py-2 text-xs font-black tracking-wider text-white uppercase transition-all hover:text-white"
        >
          View all
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-white/60" />
          </div>
        ) : featuredGig ? (
          <>
            <PastGigHomeCard featured gig={featuredGig} />

            {/* Remaining recent gigs */}
            {pastGigs.length > 0 ? (
              <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:col-span-3 lg:grid-cols-2">
                {pastGigs.map((gig: any) => (
                  <PastGigHomeCard key={gig.id} gig={gig} />
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="col-span-full py-8 text-center text-white/60">
            No past gigs available.
          </p>
        )}
      </div>
    </div>
  );
}
