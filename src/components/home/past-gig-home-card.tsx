"use client"

import { formatDate } from "~/lib/date-utils"
import { GigPhotoCarousel } from "./gig-photo-carousel"
import Link from "next/link"
import { AccentGlowCard } from "~/components/ui/accent-glow-card"
import { motion } from "framer-motion"

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
  featured?: boolean
}

const MotionLink = motion.create(Link)

export function PastGigHomeCard({ gig, featured = false }: PastGigHomeCardProps) {
  if (featured) {
    return (
      <AccentGlowCard
        asChild
        className="flex flex-col justify-between gap-4 p-6 sm:p-8 lg:col-span-3"
      >
        <MotionLink
          href={`/gigs/${gig.id}`}
          className="flex flex-col gap-4 justify-between h-full"
        >
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="flex h-full flex-col justify-between gap-4">
              <h3 className="text-xl font-black uppercase leading-tight tracking-tight text-white sm:text-3xl mb-3">
                {gig.title}
              </h3>

              <div className="flex justify-between gap-4">
                <div className="flex flex-col justify-end gap-2">
                  <p className="text-white/60 text-base font-medium">
                    {gig.subtitle}
                  </p>

                  <div className="text-2xl font-black uppercase tracking-tight text-accent-muted">
                    {formatDate(gig.gigStartTime)}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:mt-2">
              <GigPhotoCarousel media={gig.media ?? []} gigTitle={gig.title} />
            </div>
          </div>
        </MotionLink>
      </AccentGlowCard>
    )
  }

  return (
    <AccentGlowCard asChild className="flex flex-col justify-between gap-2 p-6">
      <MotionLink href={`/gigs/${gig.id}`} className="flex flex-col gap-4 justify-between h-full">
        <div className="flex items-start justify-between gap-3">
          <h3 className="mb-3 text-xl font-black uppercase leading-tight tracking-tight text-white sm:text-2xl">
            {gig.title}
          </h3>

          {/* <Link
            href={`/gigs/${gig.id}`}
            className="inline-flex items-center gap-2 rounded-none border-2 border-white/30 bg-transparent px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-all hover:border-accent-muted hover:bg-accent-muted/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-muted"
            aria-label={`View details for ${gig.title}`}
          >
            <ExternalLink className="h-4 w-4" />
          </Link> */}
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col justify-end gap-2">
            <p className="text-base font-medium text-white/60">{gig.subtitle}</p>

            <div className="text-2xl font-black uppercase tracking-tight text-accent-muted">
              {formatDate(gig.gigStartTime)}
            </div>

            {/* <GigTagList gigTags={gig.gigTags} size="sm" /> */}
          </div>

          <div className="w-full sm:w-5/12">
            <GigPhotoCarousel media={gig.media ?? []} gigTitle={gig.title} variant="default" />
          </div>
        </div>
      </MotionLink>
    </AccentGlowCard>
  )
}
