"use client"

import Link from "next/link"
import { formatDate, formatTime } from "~/lib/date-utils"
import { motion } from "framer-motion"
import { GigTagList } from "~/components/gig-tag-list"

type Gig = {
  id: string
  gigStartTime: Date
  title: string
  subtitle: string
  gigEndTime?: Date | null
  ticketLink?: string | null
  gigTags?: Array<{ gigTag: { id: string; name: string; color: string } }> | null
}

type UpcomingGigCardProps = {
  gig: Gig
}

export function UpcomingGigCard({ gig }: UpcomingGigCardProps) {
  return (
    <motion.div
      className="group relative overflow-hidden rounded-none border-2 border-white/10 bg-black/80 p-6 backdrop-blur-sm transition-all hover:border-accent-strong hover:shadow-[0_0_20px_var(--accent-muted)]"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {/* Left accent bar */}
      <div className="absolute left-0 top-0 h-full w-1 bg-accent-strong transition-all group-hover:w-2" />

      <Link href={`/gigs/${gig.id}`} className="block">
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          {/* Date/Time Section */}
          <div className="flex shrink-0 flex-col items-start md:w-40">
            <div className="text-4xl font-black uppercase leading-none tracking-tight md:text-5xl text-white">
              {formatDate(gig.gigStartTime)}
            </div>
            <div className="mt-2 text-sm font-bold uppercase tracking-wider text-accent-strong">
              {gig.gigEndTime
                ? `${formatTime(gig.gigStartTime)} - ${formatTime(gig.gigEndTime)}`
                : `${formatTime(gig.gigStartTime)}`}
            </div>
          </div>

          {/* Event Details Section */}
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="text-2xl font-black uppercase leading-tight tracking-tight md:text-3xl text-white">
                {gig.title}
              </h3>
              <p className="mt-2 text-base font-medium text-white/70 md:text-lg">{gig.subtitle}</p>
            </div>

            {/* Tags */}
            <GigTagList gigTags={gig.gigTags} size="sm" />
          </div>
        </div>
      </Link>

      {/* Action Buttons */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row md:justify-end">
        <Link
          href={`/gigs/${gig.id}`}
          className="flex-1 rounded-none border-2 border-white/30 bg-transparent px-6 py-3 text-center text-sm font-black uppercase tracking-wider text-white transition-all hover:border-white hover:bg-white/10 sm:flex-none"
        >
          View Details
        </Link>
        {gig.ticketLink && (
          <a
            href={gig.ticketLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-none bg-accent-strong px-6 py-3 text-center text-sm font-black uppercase tracking-wider text-white transition-all hover:bg-accent-muted hover:shadow-[0_0_20px_var(--accent-muted)] sm:flex-none"
            onClick={(e) => e.stopPropagation()}
          >
            Get Tickets
          </a>
        )}
      </div>
    </motion.div>
  )
}
