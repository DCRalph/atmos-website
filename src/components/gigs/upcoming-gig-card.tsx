"use client";

import Link from "next/link";
import { formatDate, formatTime } from "~/lib/date-utils";
import { motion } from "framer-motion";
import { GigTagList } from "~/components/gig-tag-list";
import Image from "next/image";
import { MarkdownContent } from "~/components/markdown-content";

import { type RouterOutputs } from "~/trpc/react";

type Gig = RouterOutputs["gigs"]["getToday"][number];

type UpcomingGigCardProps = {
  gig: Gig;
};

export function UpcomingGigCard({ gig }: UpcomingGigCardProps) {
  return (
    <motion.div
      className="group hover:border-accent-muted/50 relative overflow-hidden rounded-none border-2 border-white/10 bg-black/80 p-5 backdrop-blur-sm transition-all hover:shadow-[0_0_15px_var(--accent-muted)]"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <Link href={`/gigs/${gig.id}`} className="block">
        <div className="flex flex-col gap-5 h-full md:flex-row md:items-start">
          {gig.posterFileUpload?.url && (
            <div className="w-full overflow-hidden bg-black/20 sm:w-1/3 md:w-1/2">
              <Image
                src={gig.posterFileUpload.url}
                alt={`${gig.title} poster`}
                width={gig.posterFileUpload.width ?? 1000}
                height={gig.posterFileUpload.height ?? 1500}
                sizes="(max-width: 768px) 100vw, 33vw"
                className="block w-full h-auto transition-transform duration-300 hover:scale-105"
              />
            </div>
          )}


          <div className="flex h-full flex-col">
            <h3 className="text-2xl leading-tight font-black tracking-tight text-white uppercase md:text-4xl">
              {gig.title}
            </h3>


            <div className="mt-2 text-sm font-medium text-white/70 uppercase tracking-wider md:text-base">
              <MarkdownContent size="sm" content={String(gig.description)} />
            </div>




            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-4">
                <div className="text-xl leading-none font-black tracking-tight text-white uppercase md:text-2xl">
                  {formatDate(gig.gigStartTime)}
                </div>

                <div className="text-accent-muted text-xl md:text-2xl font-bold tracking-wider uppercase">
                  {gig.gigEndTime
                    ? `${formatTime(gig.gigStartTime)} - ${formatTime(gig.gigEndTime)}`
                    : `${formatTime(gig.gigStartTime)}`}
                </div>
              </div>
              <GigTagList gigTags={gig.gigTags} size="sm" />
            </div>
          </div>
        </div>
      </Link>

      {/* Action Buttons */}
      <div className="mt-5 flex flex-col gap-2 border-t border-white/10 bg-black/95 px-3 py-2 sm:flex-row sm:items-center sm:justify-end">
        <Link
          href={`/gigs/${gig.id}`}
          className="flex-1 rounded-none border-2 border-white/30 bg-transparent px-3 py-2 text-center text-[11px] font-black tracking-wider text-white uppercase transition-all hover:border-white hover:bg-white/10 sm:flex-none"
        >
          View Details
        </Link>
        {gig.ticketLink && (
          <a
            href={gig.ticketLink}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-accent-muted hover:bg-accent-muted flex-1 rounded-none px-3 py-2 text-center text-[11px] font-black tracking-wider text-black uppercase transition-all hover:shadow-[0_0_15px_var(--accent-muted)] sm:flex-none"
            onClick={(e) => e.stopPropagation()}
          >
            Get Tickets
          </a>
        )}
      </div>
    </motion.div>
  );
}
