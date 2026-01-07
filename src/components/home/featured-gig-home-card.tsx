"use client"

import { motion } from "motion/react"
import { formatDate } from "~/lib/date-utils"
import { Badge } from "~/components/ui/badge"
import { isLightColor } from "~/lib/utils"
import { GigPhotoCarousel } from "./gig-photo-carousel"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

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
      className="group relative overflow-hidden rounded-none border-2 border-white/10 bg-black/90 p-6 sm:p-8 backdrop-blur-sm transition-all hover:border-accent-muted hover:bg-black hover:shadow-[0_0_25px_rgba(239,68,68,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-muted lg:col-span-3"
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      aria-label={`Open most recent gig: ${gig.title}`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute inset-0 bg-linear-to-br from-accent-muted/10 via-transparent to-transparent" />
        <div className="absolute -right-24 top-0 h-72 w-72 rounded-full bg-accent-muted/20 blur-3xl" />
      </div>

      <div className="absolute left-0 top-0 h-2 w-32 bg-accent-muted transition-all group-hover:w-48" />

      <div className="relative">
        <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-none bg-accent-muted px-3 py-1.5 text-xs font-black uppercase tracking-widest">
              FEATURED
            </span>
            <span className="rounded-none border-2 border-white/20 bg-black/50 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-white/90">
              MOST RECENT
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-xs font-bold uppercase tracking-wider text-white/60 transition-colors group-hover:text-accent-muted">
              {formatDate(gig.gigStartTime, "long")}
            </div>

            <Link
              href={`/gigs/${gig.id}`}
              className="group flex shrink-0 items-center gap-2 rounded-none border-2 border-white/30 bg-transparent px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-all hover:border-accent-muted hover:bg-accent-muted/10 hover:text-white"
            >
              View Details
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>

          </div>

        </div>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-end">
          <div>
            <h3 className="text-2xl font-black uppercase leading-tight tracking-tight sm:text-3xl md:text-4xl">
              {gig.title}
            </h3>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-white/70 sm:text-base">
              {gig.subtitle}
            </p>

            {gig.gigTags && gig.gigTags.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {gig.gigTags.slice(0, 6).map((gt) => (
                  <Badge
                    key={gt.gigTag.id}
                    variant="outline"
                    className="rounded-none border-2 px-3 py-1 font-bold uppercase tracking-wide"
                    style={{
                      backgroundColor: gt.gigTag.color + "20",
                      borderColor: gt.gigTag.color,
                      color: isLightColor(gt.gigTag.color) ? "black" : "white",
                    }}
                  >
                    {gt.gigTag.name}
                  </Badge>
                ))}
                {gig.gigTags.length > 6 ? (
                  <span className="rounded-none border-2 border-white/20 bg-black/40 px-3 py-1 text-xs font-black uppercase text-white/70">
                    +{gig.gigTags.length - 6}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {gig.media && gig.media.length > 0 ? (
            <GigPhotoCarousel media={gig.media} gigTitle={gig.title} />
          ) : (
            <div className="flex flex-col gap-3 rounded-none border-2 border-white/10 bg-black/40 p-4 sm:p-5">
              <p className="text-xs font-black uppercase tracking-widest text-accent-muted">Featured Photos</p>
              <div className="flex h-32 items-center justify-center rounded-none border-2 border-dashed border-white/20">
                <p className="text-xs font-bold uppercase tracking-wider text-white/40">No photos available</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
