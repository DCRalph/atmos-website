"use client";

import { Loader2, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { ContentItem } from "~/components/content/content-item";
import { api } from "~/trpc/react";
import { orbitron } from "~/lib/fonts";
import { FeaturedContentItem } from "./featured-content-item";

function getHostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

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
      <div className="mb-6 sm:mb-8 flex items-end justify-between gap-4 border-b border-white/20 pb-3 sm:pb-4">
        <h2 className={`text-2xl sm:text-3xl font-bold tracking-wide md:text-4xl ${orbitron.className}`}>
          Latest Content
        </h2>
        <Link href="/content" className="shrink-0">
          <Button
            variant="outline"
            className="h-9 rounded-full border-white/20 bg-white/5 px-4 text-xs font-semibold tracking-wide text-white/90 hover:bg-white/10 hover:text-white"
          >
            View all
            <ArrowUpRight className="ml-1.5 h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {isLoadingContent ? (
          <div className="flex items-center justify-center py-8 col-span-full">
            <Loader2 className="w-6 h-6 animate-spin text-white/60" />
          </div>
        ) : latestContentItem ? (
          <>
            {/* Featured (most recent) item */}
            <FeaturedContentItem
              id={latestContentItem.id}
              type={latestContentItem.type}
              title={latestContentItem.title}
              description={latestContentItem.description}
              date={latestContentItem.date}
              link={latestContentItem.link}
              hostname={getHostname(latestContentItem.link)}
            />

            {/* Remaining recent items */}
            {otherRecentContentItems.length > 0 ? (
              <div className="lg:col-span-3 grid gap-4 sm:gap-6 md:grid-cols-2">
                {otherRecentContentItems.map((item) => (
                  <ContentItem
                    key={item.id}
                    id={item.id}
                    type={item.type}
                    title={item.title}
                    description={item.description}
                    date={item.date}
                    link={item.link}
                  />
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-white/60 text-center py-8 col-span-full">No content available.</p>
        )}
      </div>
    </div>
  );
}
