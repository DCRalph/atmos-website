"use client";

import { formatDate, formatTime } from "~/lib/date-utils";
import { motion } from "framer-motion";
import Image from "next/image";

import { type RouterOutputs } from "~/trpc/react";
import Link from "next/link";

type Gig = RouterOutputs["gigs"]["getToday"][number];

type PastGigCardProps = {
  gig: Gig;
  upcomming?: boolean;
};

const MotionLink = motion.create(Link);

export function PastGigCard({ gig, upcomming = false }: PastGigCardProps) {
  const isTba = gig.mode === "TO_BE_ANNOUNCED";
  const displayTitle = isTba ? "TBA..." : gig.title;

  return (
    <MotionLink
      href={`/gigs/${gig.id}`}
      className="group hover:border-accent-muted/50 relative flex flex-col justify-between overflow-hidden rounded-none border-2 border-white/10 bg-black/80 backdrop-blur-sm transition-all hover:bg-black/90 hover:shadow-[0_0_15px_var(--accent-muted)]"
    >
      {gig.posterFileUpload && (
        <div className="relative w-full h-full flex items-center justify-center">
          <Image
            src={gig.posterFileUpload.url}
            alt={isTba ? "TBA poster" : `${gig.title} poster`}
            width={gig.posterFileUpload.width ?? 1000}
            height={gig.posterFileUpload.height ?? 1500}
            sizes="100vw"
            className={`block h-auto w-full bg-black/20 ${isTba
                ? "blur-md"
                : "transition-transform duration-300 hover:scale-105"
              }`}
          />
          {isTba && (
            <div className="absolute inset-0 flex items-center justify-center">
              <h3 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white uppercase drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
                TBA...
              </h3>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-white/10 bg-black/95">
        {!isTba && (
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <h3 className="text-xs text-center font-black tracking-wider text-white uppercase sm:text-sm">
              {displayTitle}
            </h3>
          </div>
        )}

        {!isTba && (
          <div className="grid grid-cols-2 border-t-2 border-white/10 text-center text-[10px] font-semibold tracking-wider text-white/70 uppercase md:grid-cols-3 md:text-sm">
            <div className="border-white/10 flex items-center justify-center border-r-2 px-3 py-2">
              {gig.subtitle}
            </div>

            <div className="border-white/10 flex items-center justify-center border-r-0 px-3 py-2 md:border-r-2">
              {formatDate(gig.gigStartTime, upcomming ? "extra-short" : "short")}
            </div>

            <div className="hidden items-center justify-center px-3 py-2 md:flex">
              {formatTime(gig.gigStartTime)}
            </div>
          </div>
        )}
      </div>
    </MotionLink>
  );
}
