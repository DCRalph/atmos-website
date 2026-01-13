"use client"

import { formatDate } from "~/lib/date-utils"
import { Badge } from "~/components/ui/badge"
import { isLightColor } from "~/lib/utils"
import { motion } from "framer-motion"

type Gig = {
  id: string
  gigStartTime: Date
  title: string
  subtitle: string
  media?: Array<unknown> | null
  gigTags?: Array<{ gigTag: { id: string; name: string; color: string } }> | null
}

type PastGigHomeCardProps = {
  gig: Gig
}

export function PastGigHomeCard({ gig }: PastGigHomeCardProps) {
  return (
    <motion.a
      href={`/gigs/${gig.id}`}
      className="group relative  overflow-hidden flex flex-col justify-between gap-2 rounded-none border-2 border-white/10 bg-black/80 p-6 backdrop-blur-sm transition-all hover:border-accent-muted/50 hover:bg-black/90 hover:shadow-[0_0_15px_var(--accent-muted)]"
    >
      <div className="absolute right-0 top-0 h-1 w-16 bg-accent-muted opacity-50 transition-all group-hover:w-full group-hover:opacity-100" />

      <h3 className="text-xl font-black uppercase leading-tight tracking-tight text-white sm:text-2xl mb-3">
        {gig.title}
      </h3>

      <div className="flex flex-col gap-2">

        <p className="text-white/60 text-base font-medium">{gig.subtitle}</p>

        <div className="text-2xl font-black uppercase tracking-tight text-accent-muted">
          {formatDate(gig.gigStartTime)}
        </div>

        {gig.gigTags && gig.gigTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {gig.gigTags.map((gt) => (
              <Badge
                key={gt.gigTag.id}
                variant="outline"
                className="rounded-none border-2 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide"
                style={{
                  backgroundColor: gt.gigTag.color + "20",
                  borderColor: gt.gigTag.color,
                  color: isLightColor(gt.gigTag.color) ? "black" : "white",
                }}
              >
                {gt.gigTag.name}
              </Badge>
            ))}
          </div>
        )}

        {gig.media && gig.media.length > 0 && (
          <p className="text-sm font-bold uppercase tracking-wider text-white/50">
            {gig.media.length} {gig.media.length === 1 ? "media item" : "media items"}
          </p>
        )}
      </div>
    </motion.a>
  )
}
