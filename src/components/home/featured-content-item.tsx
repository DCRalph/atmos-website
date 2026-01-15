"use client";

import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";

import { SoundCloudPlayer } from "~/components/soundcloud-player";

type FeaturedContentItemProps = {
  id: string;
  type: string;
  title: string;
  description: string;
  date: Date;
  link: string;
  linkType: "SOUNDCLOUD_TRACK" | "SOUNDCLOUD_PLAYLIST" | "OTHER";
  hostname?: string;
};

export function FeaturedContentItem({
  type,
  title,
  description,
  date,
  link,
  linkType,
  hostname,
}: FeaturedContentItemProps) {
  const isSoundCloudTrack = linkType === "SOUNDCLOUD_TRACK";

  return (
    <motion.div
      className="group relative overflow-hidden rounded-none border-2 border-white/10 bg-black/90 p-6 backdrop-blur-sm transition-all hover:border-accent-muted/60 hover:shadow-[0_0_20px_var(--accent-muted)] lg:col-span-3"
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      <div className="absolute left-0 top-0 h-full w-1 bg-accent-strong transition-all group-hover:w-2" />

      <div className="relative">
        <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-none border-2 border-white/20 bg-black/40 px-3 py-1 text-xs font-black uppercase tracking-wider text-white">
              {type}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-white/60">
            <span>
              {date.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            {hostname ? (
              <>
                <span className="h-1 w-1 rounded-full bg-white/25" />
                <span className="truncate">{hostname}</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_280px] md:items-start">
          <div>
            <h3 className="text-2xl font-black uppercase leading-tight tracking-tight text-white sm:text-3xl md:text-4xl">
              {title}
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">
              {description}
            </p>

            {isSoundCloudTrack ? (
              <div className="mt-5 overflow-hidden rounded-none border-2 border-white/10 bg-black/60">
                <SoundCloudPlayer
                  url={link}
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
                  }}
                />
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-none border-2 border-white/30 bg-transparent px-6 py-3 text-center text-sm font-black uppercase tracking-wider text-white transition-all hover:border-white hover:bg-white/10 sm:flex-none"
              >
                Open
              </a>
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 flex-1 rounded-none bg-accent-strong px-6 py-3 text-center text-sm font-black uppercase tracking-wider text-white transition-all hover:bg-accent-muted hover:shadow-[0_0_20px_var(--accent-muted)] sm:flex-none"
              >
                View
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          {!isSoundCloudTrack ? (
            <div className="relative aspect-square w-full overflow-hidden rounded-none border-2 border-white/10 bg-black/40 shadow-lg">
              <Image
                src={"https://picsum.photos/600/600"}
                alt={`${title} thumbnail`}
                width={600}
                height={600}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent" />
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
