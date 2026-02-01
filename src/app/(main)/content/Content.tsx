"use client";

import { Loader2 } from "lucide-react";
import { StaticBackground } from "~/components/static-background";
import { ContentItem } from "~/components/content/content-item";
import { api } from "~/trpc/react";
import { AnimatedPageHeader } from "~/components/animated-page-header";

export default function ContentPage() {
  const { data: contentItems } = api.content.getAll.useQuery();
  return (
    <main className="bg-black text-white">
      <StaticBackground imageSrc="/home/atmos-1.jpg" />

      <section className="relative z-10 min-h-dvh px-4 py-8 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <AnimatedPageHeader
            title="CONTENT"
            subtitle="Releases, mixes, and highlights from the Atmos community"
          />

          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
            {!contentItems?.length ? (
              <div className="flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              contentItems?.map((item) => (
                <ContentItem
                  key={item.id}
                  id={item.id}
                  type={item.type}
                  title={item.title}
                  description={item.description}
                  date={item.date}
                  link={item.link}
                />
              ))
            )}
          </div>

          {/* Featured Video Section */}
          <div className="mt-12 sm:mt-16">
            <h2 className="mb-6 border-b border-white/20 pb-3 text-2xl font-bold tracking-wide sm:mb-8 sm:pb-4 sm:text-3xl">
              Featured
            </h2>
            <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm">
              <div className="flex aspect-video w-full items-center justify-center bg-white/10">
                <span className="text-sm text-white/40 sm:text-base">
                  Video Player
                </span>
              </div>
              <div className="p-4 sm:p-6">
                <h3 className="mb-2 text-lg font-bold sm:text-xl md:text-2xl">
                  Latest Release
                </h3>
                <p className="text-sm text-white/60 sm:text-base">
                  Our most recent performance captured live
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
