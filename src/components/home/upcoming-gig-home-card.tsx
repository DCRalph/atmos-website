"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { formatDate } from "~/lib/date-utils";
import { motion } from "motion/react";
import Image from "next/image";
import { api } from "~/trpc/react";
import { GigPoster } from "~/components/gigs/gig-poster";

type Gig = {
  id: string;
  gigStartTime: Date;
  title: string;
  subtitle: string;
  shortDescription?: string | null;
  mode?: "NORMAL" | "TO_BE_ANNOUNCED";
  gigEndTime?: Date | null;
  ticketLink?: string | null;
  posterFileUpload?: { url: string } | null;
  gigTags?: Array<{
    gigTag: { id: string; name: string; color: string };
  }> | null;
};

type UpcomingGigCardProps = {
  gig: Gig;
};

export function UpcomingGigHomeCard({ gig }: UpcomingGigCardProps) {
  const posterUrl = gig.posterFileUpload?.url ?? null;
  const isTba = gig.mode === "TO_BE_ANNOUNCED";
  const displayTitle = isTba ? "TBA..." : gig.title;
  const posterLayoutId = `gig-poster-${gig.id}`;
  const utils = api.useUtils();
  const router = useRouter();
  const gigHref = `/gigs/${gig.id}`;

  const prefetchGig = useCallback(() => {
    void router.prefetch(gigHref);
    void utils.gigs.getById.prefetch({ id: gig.id });
  }, [gig.id, gigHref, router, utils.gigs.getById]);

  useEffect(() => {
    prefetchGig();
  }, [prefetchGig]);

  return (
    <motion.div
      className="relative z-10 mx-auto flex h-full w-full max-w-md flex-col rounded-lg"
      initial={{ opacity: 0, y: "200px" }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* Poster - full width on mobile, side on desktop */}
      <Link
        href={gigHref}
        className="group relative block shadow-2xl"
        onMouseEnter={prefetchGig}
        onFocus={prefetchGig}
        onTouchStart={prefetchGig}
      >
        {posterUrl && !isTba && (
          <div className="absolute -inset-2 -bottom-6 -z-20 overflow-hidden blur-2xl sm:-inset-4 sm:bottom-0 sm:blur-3xl">
            <Image
              src={posterUrl}
              alt={`${displayTitle} poster`}
              fill
              sizes="(max-width: 768px) 100vw, 600px"
              className="object-cover"
            />
            <div className="absolute inset-0 z-10 bg-black/20" />
          </div>
        )}

        <GigPoster
          posterUrl={posterUrl}
          title={gig.title}
          isTba={isTba}
          layoutId={posterLayoutId}
          sizes="(max-width: 768px) 100vw, 600px"
          tbaClassName="text-5xl md:text-7xl"
        />
      </Link>

      {/* Content below poster */}
      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Date */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-2xl leading-tight font-black tracking-tight text-white uppercase md:text-3xl">
            {displayTitle}
          </h3>
          <span className="shrink-0 text-lg font-semibold tracking-tight text-white md:text-xl">
            {isTba ? "TBA" : formatDate(gig.gigStartTime, "extra-short")}
          </span>
          {/* <span className="font-bold tracking-wider uppercase">
              {gig.gigEndTime
                ? `${formatTime(gig.gigStartTime)} - ${formatTime(gig.gigEndTime)}`
                : formatTime(gig.gigStartTime)}
            </span> */}
        </div>

        {/* Title & Subtitle */}
        <div>
          <p className="mt-1 line-clamp-2 text-sm font-medium text-white/70 md:text-base">
            {isTba
              ? "Details coming soon"
              : (gig.shortDescription ?? gig.subtitle)}
          </p>
        </div>

        {/* Buttons - side by side */}
        <div className="mt-auto flex gap-3">
          <Link
            href={gigHref}
            className="hover:border-accent-muted hover:bg-accent-muted/10 inline-flex flex-1 items-center justify-center rounded-none border-2 border-white/30 bg-transparent px-4 py-2 text-xs font-black tracking-wider text-white uppercase transition-all hover:text-white"
            onMouseEnter={prefetchGig}
            onFocus={prefetchGig}
            onTouchStart={prefetchGig}
          >
            View Details
          </Link>
          {!isTba && gig.ticketLink && (
            <a
              href={gig.ticketLink}
              target="_blank"
              rel="noopener noreferrer"
              className="border-accent-strong bg-accent-strong hover:border-accent-muted hover:bg-accent-muted inline-flex h-12 flex-1 items-center justify-center rounded-none border-2 px-6 text-sm font-black tracking-wider text-white uppercase transition-all hover:shadow-[0_0_20px_var(--accent-muted)] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={(e) => e.stopPropagation()}
            >
              Get Tickets
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}
