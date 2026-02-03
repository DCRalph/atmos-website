"use client";

import { formatDate } from "~/lib/date-utils";
import { GigPhotoCarousel } from "./gig-photo-carousel";
import Link from "next/link";
import { AccentGlowCard } from "~/components/ui/accent-glow-card";
import { motion } from "framer-motion";
import Image from "next/image";

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
  shortDescription?: string | null;
  mode?: "NORMAL" | "TO_BE_ANNOUNCED";
  posterFileUpload?: { url: string } | null;
  media?: MediaItem[] | null;
  gigTags?: Array<{
    gigTag: { id: string; name: string; color: string };
  }> | null;
};

type PastGigHomeCardProps = {
  gig: Gig;
  featured?: boolean;
};

const MotionLink = motion.create(Link);

export function PastGigHomeCard({
  gig,
  featured = false,
}: PastGigHomeCardProps) {
  const isTba = gig.mode === "TO_BE_ANNOUNCED";
  const displayTitle = isTba ? "TBA..." : gig.title;
  const posterUrl = gig.posterFileUpload?.url ?? null;

  if (featured) {
    return (
      <AccentGlowCard
        className="lg:col-span-3"
        motionProps={{
          initial: { opacity: 0, y: "200px" },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, amount: 0.1 },
          transition: { duration: 0.5, ease: "easeOut" },
        }}
      >
        <MotionLink
          href={`/gigs/${gig.id}`}
          className="flex h-full flex-col justify-between gap-4"
        >
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="flex h-full flex-col justify-between gap-4">
              <h3 className="mb-3 text-xl leading-tight font-black tracking-tight text-white uppercase sm:text-3xl">
                {displayTitle}
              </h3>

              {!isTba && (
                <div className="flex justify-between gap-4">
                  <div className="flex flex-col justify-end gap-2">
                    <p className="text-base font-medium text-white/60">
                      {gig.shortDescription ?? gig.subtitle}
                    </p>

                    <div className="text-accent-muted text-2xl font-black tracking-tight uppercase">
                      {formatDate(gig.gigStartTime)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="lg:mt-2">
              {posterUrl ? (
                <div className="relative aspect-3/4 overflow-hidden rounded-lg border border-white/10 bg-black/20">
                  <Image
                    src={posterUrl}
                    alt={isTba ? "TBA poster" : `${gig.title} poster`}
                    fill
                    className={`object-cover ${
                      isTba ? "blur-md" : "transition-transform duration-300 hover:scale-105"
                    }`}
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  {isTba && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <h3 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white uppercase drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
                        TBA...
                      </h3>
                    </div>
                  )}
                </div>
              ) : (
                <GigPhotoCarousel
                  media={gig.media ?? []}
                  gigTitle={gig.title}
                />
              )}
            </div>
          </div>
        </MotionLink>
      </AccentGlowCard>
    );
  }

  return (
    <AccentGlowCard
      motionProps={{
        initial: { opacity: 0, y: "200px" },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "50% 0px" },
        transition: { duration: 0.5, ease: "easeOut" },
      }}>
      <MotionLink
        href={`/gigs/${gig.id}`}
        className="flex h-full flex-col justify-between gap-4"
      >
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="flex h-full flex-col justify-between gap-4">
            <h3 className="mb-3 text-xl leading-tight font-black tracking-tight text-white uppercase sm:text-2xl">
              {displayTitle}
            </h3>

            {!isTba && (
              <div className="flex flex-col gap-2">
                <p className="text-base font-medium text-white/60">
                  {gig.shortDescription ?? gig.subtitle}
                </p>

                <div className="text-accent-muted text-2xl font-black tracking-tight uppercase">
                  {formatDate(gig.gigStartTime)}
                </div>

                {/* <GigTagList gigTags={gig.gigTags} size="sm" /> */}
              </div>
            )}
          </div>

          <div className="lg:mt-2">
            {posterUrl ? (
              <div className="relative aspect-3/4 overflow-hidden rounded-lg border border-white/10 bg-black/20">
                <Image
                  src={posterUrl}
                  alt={isTba ? "TBA poster" : `${gig.title} poster`}
                  fill
                  className={`object-cover ${
                    isTba ? "blur-md" : "transition-transform duration-300 hover:scale-105"
                  }`}
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                {isTba && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <h3 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white uppercase drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
                      TBA...
                    </h3>
                  </div>
                )}
              </div>
            ) : (
              <GigPhotoCarousel
                media={gig.media ?? []}
                gigTitle={gig.title}
                variant="default"
              />
            )}
          </div>
        </div>
      </MotionLink>
    </AccentGlowCard>
  );
}
