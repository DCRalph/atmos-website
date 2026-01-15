"use client"

import Link from "next/link"
import { formatDate, formatTime } from "~/lib/date-utils"
import { motion } from "framer-motion"
import { GigTagList } from "~/components/gig-tag-list"
import { AccentGlowCard } from "~/components/ui/accent-glow-card"
import Image from "next/image"

type Gig = {
  id: string
  gigStartTime: Date
  title: string
  subtitle: string
  gigEndTime?: Date | null
  ticketLink?: string | null
  posterFileUpload?: { url: string } | null
  gigTags?: Array<{ gigTag: { id: string; name: string; color: string } }> | null
}

type UpcomingGigCardProps = {
  gig: Gig
}

export function UpcomingGigHomeCard({ gig }: UpcomingGigCardProps) {
  const posterUrl = gig.posterFileUpload?.url ?? null

  return (
    <AccentGlowCard
      asChild
      className="bg-black/90 p-6 hover:border-accent-strong hover:shadow-[0_0_20px_var(--accent-muted)]"
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >

        <Link href={`/gigs/${gig.id}`} className="block">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            {posterUrl && (
              <div className="relative aspect-3/4 w-full max-w-[240px] overflow-hidden rounded-none border-2 border-white/10 bg-black/20 md:w-32 md:max-w-none">
                <Image
                  src={posterUrl}
                  alt={`${gig.title} poster`}
                  fill
                  sizes="(max-width: 768px) 240px, 128px"
                  className="object-cover"
                />
              </div>
            )}

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

            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-2xl font-black uppercase leading-tight tracking-tight md:text-3xl text-white">
                  {gig.title}
                </h3>
                <p className="mt-2 text-base font-medium text-white/70 md:text-lg">{gig.subtitle}</p>
              </div>

              {/* <GigTagList gigTags={gig.gigTags} size="sm" /> */}
            </div>
          </div>
        </Link>

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
    </AccentGlowCard>
  )
}
