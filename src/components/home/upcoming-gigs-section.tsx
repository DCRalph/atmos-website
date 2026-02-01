"use client";

import { Loader2 } from "lucide-react";
import { UpcomingGigHomeCard } from "./upcoming-gig-home-card";
import { api } from "~/trpc/react";
import { orbitron } from "~/lib/fonts";
import { motion } from "motion/react";

export function UpcomingGigsSection() {
  const { data: upcomingGigs, isLoading: isLoadingUpcomingGigs } =
    api.gigs.getUpcoming.useQuery();

  return (
    <div className="mb-16 sm:mb-20">
      <motion.h2
        initial={{ opacity: 0, x: "100%" }}
        whileInView={{ opacity: 1, x: 0, transition: { duration: 0.5, ease: "easeOut" } }}
        viewport={{ once: true }}

        className={`mb-6 border-b-2 border-white/10 pb-3 text-2xl font-black tracking-tight uppercase sm:mb-8 sm:pb-4 sm:text-3xl md:text-4xl ${orbitron.className}`}
      >
        Upcoming Gigs
      </motion.h2>
      <div className="flex flex-col gap-4">
        {isLoadingUpcomingGigs ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-white/60" />
          </div>
        ) : // ) : upcomingGigs && upcomingGigs.filter((gig) => gig.gigStartTime).length > 0 ?
          upcomingGigs && upcomingGigs.length > 0 ? (
            upcomingGigs
              // .filter((gig) => gig.gigStartTime)
              .map((gig) => <UpcomingGigHomeCard key={gig.id} gig={gig} />)
          ) : (
            <p className="py-8 text-center text-white/60">
              No upcoming gigs scheduled.
            </p>
          )}
      </div>
    </div>
  );
}
