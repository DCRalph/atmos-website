"use client";

import { Loader2 } from "lucide-react";
import { StaticBackground } from "~/components/static-background";
import { api } from "~/trpc/react";
import { AnimatedPageHeader } from "~/components/animated-page-header";
import { ContentCard } from "~/components/content/content-card";
import { orbitron } from "~/lib/fonts";
import { AccentGlowCard } from "~/components/ui/accent-glow-card";
import { MainPageSection } from "~/components/main-page-section";

export default function ContentPage() {
  const { data: contentItems, isLoading } = api.content.getAll.useQuery();
  const featuredItem = contentItems?.[0];
  const remainingItems = contentItems?.slice(1) ?? [];

  return (
    <main className="min-h-content bg-black text-white">
      <StaticBackground imageSrc="/home/atmos-1.jpg" />

      <MainPageSection className="px-4 pb-16 pt-6 sm:pt-8">
        <AnimatedPageHeader
          title="CONTENT"
          subtitle="Releases, mixes, and highlights from the Atmos community"
        />

        <div className="mb-8 flex flex-col gap-4 border-b-2 border-white/10 pb-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between sm:pb-6">
          <div>
            <h2
              className={`text-2xl font-black tracking-tight uppercase sm:text-3xl md:text-4xl ${orbitron.className}`}
            >
              Latest Drops
            </h2>
            {/* <p className="mt-2 max-w-2xl text-sm text-white/50 sm:text-base">
              Tap into the newest mixes, live captures, and community releases.
            </p> */}
          </div>
          <div className="flex items-center gap-3 text-xs font-bold tracking-wider text-white/50 uppercase">
            {contentItems && (
              <span className="text-white/70">{contentItems.length} items</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
          {isLoading ? (
            <div className="col-span-full flex items-center justify-center border-2 border-white/10 bg-black/80 py-12 backdrop-blur-sm">
              <Loader2 className="text-accent-muted h-6 w-6 animate-spin" />
            </div>
          ) : featuredItem ? (
            <>
              <ContentCard featured contentItem={featuredItem} />
              {remainingItems.map((item) => (
                <ContentCard key={item.id} contentItem={item} />
              ))}
            </>
          ) : (
            <div className="col-span-full border-2 border-white/10 bg-black/80 p-8 text-center backdrop-blur-sm">
              <p className="font-bold tracking-wider text-white/60 uppercase">
                No content available
              </p>
              <p className="mt-2 text-sm text-white/40">
                Check back soon for new drops.
              </p>
            </div>
          )}
        </div>

        <div className="mt-10 hidden sm:mt-14">
          <AccentGlowCard>
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-3">
                <p className="text-xs font-bold tracking-wider text-white/60 uppercase">
                  Spotlight
                </p>
                <h3 className="text-2xl font-black tracking-tight uppercase sm:text-3xl">
                  Atmos highlights, curated regularly
                </h3>
                <p className="text-sm text-white/60 sm:text-base">
                  Every week we pull the sharpest new mixes and live moments into
                  one place so you can press play fast.
                </p>
              </div>
              <div className="flex flex-col justify-between gap-4 border-t border-white/10 pt-4 text-sm text-white/60 lg:border-t-0 lg:border-l lg:pl-6">
                <div>
                  <p className="text-xs font-bold tracking-wider text-white/50 uppercase">
                    Updated
                  </p>
                  <p className="mt-2 text-white/80">
                    Fresh picks added over time.
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold tracking-wider text-white/50 uppercase">
                    Want in?
                  </p>
                  <p className="mt-2 text-white/80">
                    Share your latest set with the crew.
                  </p>
                </div>
              </div>
            </div>
          </AccentGlowCard>
        </div>
      </MainPageSection>
    </main>
  );
}
