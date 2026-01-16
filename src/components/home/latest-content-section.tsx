"use client";

import { Loader2, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { ContentCard } from "~/components/home/content-card";
import { api } from "~/trpc/react";
import { orbitron } from "~/lib/fonts";



export function LatestContentSection() {
  const { data: contentItems, isLoading: isLoadingContent } = api.content.getAll.useQuery();

  // Ensure "latest" content is actually the most recent by date
  const sortedContentItems = (contentItems ?? []).slice().sort((a, b) => b.date.getTime() - a.date.getTime());
  // Limit content items to 3 most recent
  const recentContentItems = sortedContentItems.slice(0, 3);
  const latestContentItem = recentContentItems[0];
  const otherRecentContentItems = recentContentItems.slice(1);

  return (
    <div className="mb-16 sm:mb-20">
      <div className="mb-6 sm:mb-8 flex items-end justify-between gap-4 border-b-2 border-white/10 pb-3 sm:pb-4">
        <h2 className={`text-2xl sm:text-3xl font-black uppercase tracking-tight md:text-4xl ${orbitron.className}`}>
          Latest Content
        </h2>
        <Link
          href="/content"
          className="group flex shrink-0 items-center gap-2 rounded-none border-2 border-white/30 bg-transparent px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-all hover:border-accent-muted hover:bg-accent-muted/10 hover:text-white"
        >
          View all
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-2">
        {isLoadingContent ? (
          <div className="flex items-center justify-center py-8 col-span-full">
            <Loader2 className="w-6 h-6 animate-spin text-white/60" />
          </div>
        ) : latestContentItem ? (
          <>
            {/* Featured (most recent) item */}
            <ContentCard
              featured
              contentItem={latestContentItem}
            />

            {/* Remaining recent items */}
            {otherRecentContentItems.length > 0 && otherRecentContentItems.map((item) => (
              <ContentCard
                key={item.id}
                contentItem={item}
              />
            ))}
          </>
        ) : (
          <p className="text-white/60 text-center py-8 col-span-full">No content available.</p>
        )}
      </div>
    </div>
  );
}
