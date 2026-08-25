"use client";

import { formatDate, formatTime } from "~/lib/date-utils";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { useCallback, useEffect } from "react";

import { api, type RouterOutputs } from "~/trpc/react";
import Link from "next/link";
import { GigPoster } from "~/components/gigs/gig-poster";
import { gigParam, gigPath } from "~/lib/gig-url";

type Gig = RouterOutputs["gigs"]["getToday"][number];

type PastGigCardProps = {
  gig: Gig;
  upcomming?: boolean;
};

const MotionLink = motion.create(Link);

export function PastGigCard({ gig, upcomming = false }: PastGigCardProps) {
  const isTba = gig.mode === "TO_BE_ANNOUNCED";
  const displayTitle = isTba ? "TBA..." : gig.title;
  const posterLayoutId = `gig-poster-${gig.id}`;
  const utils = api.useUtils();
  const router = useRouter();
  const gigHref = gigPath(gig);

  const prefetchGig = useCallback(() => {
    void router.prefetch(gigHref);
    void utils.gigs.getById.prefetch({ id: gigParam(gig) });
  }, [gig.id, gigHref, router, utils.gigs.getById]);

  useEffect(() => {
    prefetchGig();
  }, [prefetchGig]);

  return (
    <MotionLink
      href={gigHref}
      className="group hover:border-accent-muted/50 relative flex h-full flex-col justify-between overflow-hidden rounded-none border-2 border-white/10 bg-black/80 backdrop-blur-sm transition-all hover:bg-black/90 hover:shadow-[0_0_15px_var(--accent-muted)]"
      onMouseEnter={prefetchGig}
      onFocus={prefetchGig}
      onTouchStart={prefetchGig}
      onClick={() =>
        posthog.capture("gig_card_clicked", {
          gig_id: gig.id,
          gig_title: displayTitle,
          upcoming: upcomming ?? false,
        })
      }
    >
      <GigPoster
        posterUrl={gig.posterFileUpload?.url}
        title={gig.title}
        isTba={isTba}
        layoutId={posterLayoutId}
        sizes="(max-width: 1024px) 50vw, 33vw"
        tbaClassName="text-3xl sm:text-4xl md:text-5xl"
      />

      <div className="border-t border-white/10 bg-black/95">
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <h3 className="line-clamp-1 text-center text-xs font-black tracking-wider text-white uppercase sm:text-sm">
            {displayTitle}
          </h3>
        </div>

        <div className="grid min-h-11 grid-cols-2 border-t-2 border-white/10 text-center text-[10px] font-semibold tracking-wider text-white/70 uppercase md:min-h-14 md:grid-cols-3 md:text-sm">
          {isTba ? (
            <div className="col-span-2 flex items-center justify-center px-3 py-2 md:col-span-3">
              Date to be announced
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center border-r-2 border-white/10 px-3 py-2">
                <span className="line-clamp-2">{gig.subtitle}</span>
              </div>

              <div className="flex items-center justify-center border-r-0 border-white/10 px-3 py-2 md:border-r-2">
                {formatDate(
                  gig.gigStartTime,
                  upcomming ? "extra-short" : "short",
                )}
              </div>

              <div className="hidden items-center justify-center px-3 py-2 md:flex">
                {formatTime(gig.gigStartTime)}
              </div>
            </>
          )}
        </div>
      </div>
    </MotionLink>
  );
}
