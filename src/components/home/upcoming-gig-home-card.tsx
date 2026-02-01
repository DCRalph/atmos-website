"use client";

import Link from "next/link";
import { formatDate, formatTime } from "~/lib/date-utils";
import { motion } from "motion/react";
import Image from "next/image";
import { useIsMobile } from "~/hooks/use-mobile";

type Gig = {
  id: string;
  gigStartTime: Date;
  title: string;
  subtitle: string;
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
  const isMobile = useIsMobile();

  return (
    <motion.div
      className="relative flex w-full h-full flex-col z-10 rounded-lg max-w-md mx-auto"
      initial={{ opacity: 0, y: "200px" }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >


      {/* Poster - full width on mobile, side on desktop */}
      {posterUrl && (
        <Link href={`/gigs/${gig.id}`} className="block shadow-2xl">
          <div className="relative aspect-3/4 w-full bg-black/20">
            <Image
              src={posterUrl}
              alt={`${gig.title} poster`}
              fill
              sizes="(max-width: 768px) 100vw, 600px"
              className="object-cover"
            />

            { posterUrl && (
              <div className="absolute -inset-2 -bottom-6 sm:bottom-0 sm:-inset-4 overflow-hidden -z-20 blur-xl sm:blur-3xl ">
                <Image
                  src={posterUrl}
                  alt={`${gig.title} poster`}
                  fill
                  sizes="(max-width: 768px) 100vw, 600px"
                  className="object-cover"
                />
                <div className="absolute inset-0 z-10 bg-black/50" />
              </div>
            )}

          </div>
        </Link>
      )}

      {/* Content below poster */}
      <div className="flex flex-col gap-4 p-4">
        {/* Date */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-2xl font-black leading-tight tracking-tight text-white uppercase md:text-3xl">
            {gig.title}
          </h3>
          <span className="text-lg font-semibold tracking-tight text-white md:text-xl">
            {formatDate(gig.gigStartTime, "extra-short")}
          </span>
          {/* <span className="font-bold tracking-wider uppercase">
            {gig.gigEndTime
              ? `${formatTime(gig.gigStartTime)} - ${formatTime(gig.gigEndTime)}`
              : formatTime(gig.gigStartTime)}
          </span> */}
        </div>

        {/* Title & Subtitle */}
        <div>

          <p className="mt-1 text-sm font-medium text-white/70 md:text-base">
            {gig.subtitle}
          </p>
        </div>

        {/* Buttons - side by side */}
        <div className="flex gap-3">
          <Link
            href={`/gigs/${gig.id}`}
            className="flex-1 inline-flex items-center justify-center rounded-none border-2 border-white/30 bg-transparent px-4 py-2 text-xs font-black tracking-wider text-white uppercase transition-all hover:border-accent-muted hover:bg-accent-muted/10 hover:text-white"
          >
            View Details
          </Link>
          {gig.ticketLink && (
            <a
              href={gig.ticketLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center border-accent-strong bg-accent-strong hover:border-accent-muted hover:bg-accent-muted h-12 rounded-none border-2 px-6 text-sm font-black tracking-wider text-white uppercase transition-all hover:shadow-[0_0_20px_var(--accent-muted)] disabled:cursor-not-allowed disabled:opacity-50"
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