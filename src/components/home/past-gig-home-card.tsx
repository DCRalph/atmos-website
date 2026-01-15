"use client"

import { formatDate } from "~/lib/date-utils"
import { motion } from "framer-motion"
import { GigTagList } from "~/components/gig-tag-list"
import { GigPhotoCarousel } from "./gig-photo-carousel"
import Link from "next/link"
import { ExternalLink } from "lucide-react"

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

type PastGigHomeCardProps = {
  gig: Gig
}

const MotionLink = motion.create(Link)

export function PastGigHomeCard({ gig }: PastGigHomeCardProps) {
  return (
    <motion.div
      // href={`/gigs/${gig.id}`}
      className="group relative  overflow-hidden flex flex-col justify-between gap-2 rounded-none border-2 border-white/10 bg-black/80 p-6 backdrop-blur-sm transition-all hover:border-accent-muted/50 hover:bg-black/90 hover:shadow-[0_0_15px_var(--accent-muted)]"
    >
      <div className="absolute left-0 top-0 h-full w-1 bg-accent-strong transition-all group-hover:w-2" />

      <div className="flex justify-between items-start gap-2">

        <h3 className="text-xl font-black uppercase leading-tight tracking-tight text-white sm:text-2xl mb-3">
          {gig.title}
        </h3>

        <div className="flex flex-col gap-2 justify-end">
          <Link
            href={`/gigs/${gig.id}`}
            className="inline-flex items-center gap-2 rounded-none border-2 border-white/30 bg-transparent px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-all hover:border-accent-muted hover:bg-accent-muted/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-muted"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </div>


      <div className="flex justify-between gap-4">

        <div className="flex flex-col justify-end gap-2">

          <p className="text-white/60 text-base font-medium">{gig.subtitle}</p>

          <div className="text-2xl font-black uppercase tracking-tight text-accent-muted">
            {formatDate(gig.gigStartTime)}
          </div>

          {/* <GigTagList gigTags={gig.gigTags} size="sm" /> */}

          {/* {gig.media && gig.media.length > 0 && (
          <p className="text-sm font-bold uppercase tracking-wider text-white/50">
            {gig.media.length} {gig.media.length === 1 ? "media item" : "media items"}
          </p>
        )} */}
        </div>

        <div className="flex flex-col gap-2 justify-end w-5/12">

          {/* <div className="w-ful"> */}
          <GigPhotoCarousel media={gig.media ?? []} gigTitle={gig.title} variant="compact" />
          {/* </div> */}

        </div>
      </div>
    </motion.div>
  )
}
