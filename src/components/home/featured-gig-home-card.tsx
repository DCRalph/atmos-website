"use client"

import { formatDate } from "~/lib/date-utils"
import { motion } from "framer-motion"
import { GigPhotoCarousel } from "./gig-photo-carousel"
import { GigTagList } from "~/components/gig-tag-list"
import Link from "next/link"

type MediaItem = {
  id: string
  type: string
  url: string | null
  section: string
  sortOrder: number
  fileUploadId?: string | null
  fileUpload?: {
    id: string
    url: string
    name: string
    mimeType: string
  } | null
}

type Gig = {
  id: string
  gigStartTime: Date
  title: string
  subtitle: string
  media?: MediaItem[] | null
  gigTags?: Array<{ gigTag: { id: string; name: string; color: string } }> | null
}

type FeaturedGigCardProps = {
  gig: Gig
}

export function FeaturedGigHomeCard({ gig }: FeaturedGigCardProps) {
  return (
    <motion.div
      className="group relative overflow-hidden flex flex-col justify-between gap-4 rounded-none border-2 border-white/10 bg-black/80 p-6 sm:p-8 backdrop-blur-sm transition-all hover:border-accent-muted/50 hover:bg-black/90 hover:shadow-[0_0_15px_var(--accent-muted)] lg:col-span-3"
      aria-label={`Featured gig: ${gig.title}`}
    >
      <div className="absolute left-0 top-0 h-full w-1 bg-accent-strong transition-all group-hover:w-2" />
      {/* <div className="absolute right-0 top-0 h-1 w-16 bg-accent-muted opacity-50 transition-all group-hover:w-full group-hover:opacity-100" /> */}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex h-full flex-col justify-between gap-4">
          <h3 className="text-xl font-black uppercase leading-tight tracking-tight text-white sm:text-3xl mb-3">
            {gig.title}
          </h3>


          <div className="flex justify-between gap-4">
            <div className="flex flex-col justify-end gap-2">
              <p className="text-white/60 text-base font-medium">{gig.subtitle}</p>

              <div className="text-2xl font-black uppercase tracking-tight text-accent-muted">
                {formatDate(gig.gigStartTime)}
              </div>

              {/* <GigTagList gigTags={gig.gigTags} size="md" max={6} showOverflowCount /> */}

              {/* {gig.media && gig.media.length > 0 && (
              <p className="text-sm font-bold uppercase tracking-wider text-white/50">
                {gig.media.length} {gig.media.length === 1 ? "media item" : "media items"}
              </p>
            )} */}


            </div>


            <div className="flex flex-col gap-2 justify-end">
              <Link
                href={`/gigs/${gig.id}`}
                className="inline-flex items-center gap-2 rounded-none border-2 border-white/30 bg-transparent px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-all hover:border-accent-muted hover:bg-accent-muted/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-muted"
                aria-label={`View more about ${gig.title}`}
              >
                View more
              </Link>
            </div>

          </div>

        </div>

        <div className="lg:mt-2">
          <GigPhotoCarousel media={gig.media ?? []} gigTitle={gig.title} />
        </div>
      </div>
    </motion.div>
  )
}
