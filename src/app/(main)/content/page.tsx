"use client";

import { Loader2 } from "lucide-react";
import { StaticBackground } from "~/components/static-background";
import { ContentItem } from "~/components/content/content-item";
import { api } from "~/trpc/react";



export default function ContentPage() {
  const { data: contentItems } = api.content.getAll.useQuery();
  return (
    <main className=" bg-black text-white">
      <StaticBackground imageSrc="/home/atmos-1.jpg" />

      <section className="relative z-10 min-h-dvh px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <h1 className="mb-12 sm:mb-16 text-center text-4xl sm:text-5xl font-bold tracking-wider md:text-7xl">
            CONTENT
          </h1>

          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
            {!contentItems?.length ? (
              <div className="flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
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
            <h2 className="mb-6 sm:mb-8 text-2xl sm:text-3xl font-bold tracking-wide border-b border-white/20 pb-3 sm:pb-4">
              Featured
            </h2>
            <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm">
              <div className="aspect-video w-full bg-white/10 flex items-center justify-center">
                <span className="text-white/40 text-sm sm:text-base">Video Player</span>
              </div>
              <div className="p-4 sm:p-6">
                <h3 className="mb-2 text-lg sm:text-xl md:text-2xl font-bold">Latest Release</h3>
                <p className="text-sm sm:text-base text-white/60">
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

