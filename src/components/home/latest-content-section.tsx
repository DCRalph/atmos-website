"use client";

import { Loader2, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { ContentCard } from "~/components/home/content-card";
import { api } from "~/trpc/react";
import { orbitron } from "~/lib/fonts";
import { motion } from "motion/react";

export function LatestContentSection() {
  const { data, isLoading: isLoadingContent } =
    api.homeContent.getHomeLatest.useQuery();

  const featured = data?.featuredItem ?? null;
  const list = data?.items ?? [];

  return (
    <div className="mb-16 sm:mb-20">
      <div className="mb-6 flex items-end justify-between gap-4 border-b-2 border-white/10 pb-3 sm:mb-8 sm:pb-4">
        <motion.h2
          className={`text-2xl font-black tracking-tight uppercase sm:text-3xl md:text-4xl ${orbitron.className}`}

          initial={{ opacity: 0, x: "100%" }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          Latest Content
        </motion.h2>
        <Link
          href="/content"
          className="group hover:border-accent-muted hover:bg-accent-muted/10 flex shrink-0 items-center gap-2 rounded-none border-2 border-white/30 bg-transparent px-4 py-2 text-xs font-black tracking-wider text-white uppercase transition-all hover:text-white"
        >
          View all
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:gap-6">
        {isLoadingContent ? (
          <div className="col-span-full flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-white/60" />
          </div>
        ) : featured ? (
          <>
            {/* Featured */}
            <ContentCard featured contentItem={featured} />

            {/* Remaining items */}
            {list.length > 0 &&
              list.map((item) => <ContentCard key={item.id} contentItem={item} />)}
          </>
        ) : (
          <p className="col-span-full py-8 text-center text-white/60">
            No content available.
          </p>
        )}
      </div>
    </div>
  );
}
