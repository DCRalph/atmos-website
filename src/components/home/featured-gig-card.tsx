"use client";

import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { formatDate } from "~/lib/date-utils";
import { Badge } from "~/components/ui/badge";
import { isLightColor } from "~/lib/utils";
import { GigPhotoCarousel } from "./gig-photo-carousel";

type MediaItem = {
  id: string;
  type: string;
  url: string | null;
  section: string;
  sortOrder: number;
  fileUploadId?: string | null;
  fileUpload?: {
    id: string;
    url: string;
    name: string;
    mimeType: string;
  } | null;
};

type Gig = {
  id: string;
  gigStartTime: Date;
  title: string;
  subtitle: string;
  media?: MediaItem[] | null;
  gigTags?: Array<{ gigTag: { id: string; name: string; color: string } }> | null;
};

type FeaturedGigCardProps = {
  gig: Gig;
};

export function FeaturedGigCard({ gig }: FeaturedGigCardProps) {
  return (
    <motion.a
      href={`/gigs/${gig.id}`}
      className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-5 sm:p-8 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 lg:col-span-3"
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      aria-label={`Open most recent gig: ${gig.title}`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute inset-0 bg-linear-to-br from-white/10 via-transparent to-transparent" />
        <div className="absolute -right-24 top-0 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      </div>

      <div className="relative">
        <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              Gig
            </span>
            <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/80">
              Most recent
            </span>
          </div>
          <div className="text-xs text-white/60">{formatDate(gig.gigStartTime, "long")}</div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr] lg:items-end">
          <div>
            <h3 className="text-2xl font-bold tracking-wide sm:text-3xl md:text-4xl">
              {gig.title}
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">
              {gig.subtitle}
            </p>

            {gig.gigTags && gig.gigTags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {gig.gigTags.slice(0, 6).map((gt) => (
                  <Badge
                    key={gt.gigTag.id}
                    variant="outline"
                    className="rounded-full"
                    style={{
                      backgroundColor: gt.gigTag.color,
                      borderColor: gt.gigTag.color,
                      color: isLightColor(gt.gigTag.color) ? "black" : "white",
                    }}
                  >
                    {gt.gigTag.name}
                  </Badge>
                ))}
                {gig.gigTags.length > 6 ? (
                  <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-xs font-semibold text-white/70">
                    +{gig.gigTags.length - 6}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {gig.media && gig.media.length > 0 ? (
            <GigPhotoCarousel media={gig.media} gigTitle={gig.title} />
          ) : (
            <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/20 p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
                Featured photos
              </p>
              <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-white/20">
                <p className="text-xs text-white/40">No photos available</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.a>
  );
}
