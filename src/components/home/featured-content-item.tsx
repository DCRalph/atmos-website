"use client";

import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

type FeaturedContentItemProps = {
  id: string;
  type: string;
  title: string;
  description: string;
  date: Date;
  link: string;
  hostname?: string;
};

export function FeaturedContentItem({
  type,
  title,
  description,
  date,
  link,
  hostname,
}: FeaturedContentItemProps) {
  return (
    <motion.a
      href={link}
      className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-5 sm:p-8 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 lg:col-span-3"
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      aria-label={`Open latest ${type}: ${title}`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute inset-0 bg-linear-to-br from-white/10 via-transparent to-transparent" />
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      </div>

      <div className="relative">
        <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              {type}
            </span>
            <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/80">
              Most recent
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/60">
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

        <div className="flex gap-4 justify-between lg:items-end">
          <div>
            <h3 className="text-2xl font-bold tracking-wide sm:text-3xl md:text-4xl">{title}</h3>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">
              {description}
            </p>
          </div>

          {/* <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/20 p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
              Quick info
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-white/50">Type</p>
                <p className="font-semibold text-white/90">{type}</p>
              </div>
              <div>
                <p className="text-xs text-white/50">Date</p>
                <p className="font-semibold text-white/90">
                  {date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>

            <div className="mt-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-white/70 transition-colors group-hover:text-white">
                Open now
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-white/70 transition-colors group-hover:text-white">
                <span className="translate-x-0 transition-transform duration-200 group-hover:translate-x-0.5">
                  Explore
                </span>
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </div>
          </div> */}


          <div className="relative max-w-56 flex-1 aspect-square rounded-lg overflow-hidden border border-white/10 bg-black/20 shadow-lg mb-2 lg:mb-0 transition-all hover:border-white/30">
            <Image
              src={"https://picsum.photos/300/300"}
              alt={title + " thumbnail"}
              width={300}
              height={300}
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </div>

        </div>
      </div>
    </motion.a>
  );
}
