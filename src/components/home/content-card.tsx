"use client";

import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";

import { SoundCloudPlayer } from "~/components/soundcloud-player";
import { type ContentItem } from "~Prisma/client";
import { cn } from "~/lib/utils";
import { AccentGlowCard } from "~/components/ui/accent-glow-card";

type ContentCardProps = {
  contentItem: ContentItem;
  featured?: boolean;
  className?: string;
};

export function ContentCard({
  contentItem,
  featured = false,
  className,
}: ContentCardProps) {
  const isSoundCloudTrack = contentItem.linkType === "SOUNDCLOUD_TRACK";

  return (
    <AccentGlowCard
      asChild
      className={cn(
        "flex flex-col justify-between gap-4 p-6",
        featured ? "col-span-full" : "col-span-full lg:col-span-1",
        className,
      )}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <div className={`grid grid-cols-12 gap-6`}>
          <div
            className={cn(
              "flex h-full flex-col gap-6",
              isSoundCloudTrack
                ? "col-span-full lg:col-span-7"
                : "col-span-full",
            )}
          >
            <div>
              <h3 className="text-xl leading-tight font-black tracking-tight text-white uppercase sm:text-3xl">
                {contentItem.title}
              </h3>
              <div className="text-xs font-bold tracking-wider text-white/60 uppercase">
                {contentItem.date.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>

            <div>
              {contentItem.dj && (
                <h4 className="text-lg leading-tight font-black tracking-tight text-white uppercase sm:text-xl">
                  {contentItem.dj}
                </h4>
              )}

              <p className="text-base font-medium text-white/60">
                {contentItem.description}
              </p>
            </div>
          </div>

          {isSoundCloudTrack && (
            <div className="col-span-full lg:col-span-5">
              <div className="overflow-hidden rounded-none border-2 border-white/10 bg-black/60">
                <SoundCloudPlayer
                  url={contentItem.link}
                  size="default"
                  params={{
                    auto_play: false,
                    color: "#470082",
                    buying: false,
                    sharing: false,
                    download: false,
                    show_artwork: true,
                    show_playcount: false,
                    show_user: false,
                    single_active: false,
                    visual: true,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AccentGlowCard>
  );
}
