"use client";

import { formatDate, formatTime } from "~/lib/date-utils";
import { motion } from "framer-motion";
import Image from "next/image";

import { type RouterOutputs } from "~/trpc/react";

type Gig = RouterOutputs["gigs"]["getToday"][number];

type PastGigCardProps = {
  gig: Gig;
};

export function PastGigCard({ gig }: PastGigCardProps) {
  return (
    <motion.a
      href={`/gigs/${gig.id}`}
      className="group hover:border-accent-muted/50 relative flex flex-col justify-between overflow-hidden rounded-none border-2 border-white/10 bg-black/80 backdrop-blur-sm transition-all hover:bg-black/90 hover:shadow-[0_0_15px_var(--accent-muted)]"
    >
      {gig.posterFileUpload && (
        <div className="w-full">
          <Image
            src={gig.posterFileUpload.url}
            alt={`${gig.title} poster`}
            width={gig.posterFileUpload.width ?? 1000}
            height={gig.posterFileUpload.height ?? 1500}
            sizes="100vw"
            className="block w-full h-auto bg-black/20 transition-transform duration-300 hover:scale-105"
          />
        </div>
      )}

      <div className="border-t border-white/10 bg-black/95">
      
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <h3 className="text-xs font-black tracking-wider text-white uppercase sm:text-sm">
            {gig.title}
          </h3>
        </div>

        <div className="grid grid-cols-3 border-t border-white/10 text-[11px] font-semibold tracking-wider text-white/70 uppercase">

          <div className="border-white/10 px-3 py-2 sm:border-r flex items-center justify-center">
            {gig.subtitle}
          </div>

          <div className="border-white/10 px-3 py-2 sm:border-r flex items-center justify-center">
            {formatDate(gig.gigStartTime)}
          </div>

          <div className="px-3 py-2 flex items-center justify-center">{formatTime(gig.gigStartTime)}</div>

        </div>
      </div>
    </motion.a>
  );
}
