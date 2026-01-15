"use client";

import { NewsletterSection } from "~/components/home/newsletter-section";
import { UpcomingGigsSection } from "./upcoming-gigs-section";
import { LatestContentSection } from "./latest-content-section";
import { RecentGigsSection } from "./recent-gigs-section";
import { SoundCloudPlayer } from "~/components/soundcloud-player";
import { cn } from "~/lib/utils";

type HomeBottomContentProps = {
  isMobile?: boolean;
  className?: string;
};

export function HomeBottomContent({
  isMobile,
  className,
}: HomeBottomContentProps) {
  return (
    <main className={cn("relative flex-1 bg-black text-white min-h-screen ", className)}>
      {/* <StaticBackground imageSrc="/home/atmos-46.jpg" /> */}


      <section className="relative z-10 min-h-screen px-4 pt-6 pb-16 sm:pb-24">
        <div className="mx-auto max-w-6xl">
          {/* About Section */}
          {/* <div className="mb-12 sm:mb-16">
            <p className="text-sm sm:text-base text-white/50 leading-relaxed max-w-2xl">
              A collective of DJs, producers, and creatives based in Pōneke (Wellington), New Zealand.
            </p>
          </div> */}

          <UpcomingGigsSection />
          <LatestContentSection />

          <RecentGigsSection />

          <NewsletterSection />
        </div>
      </section>
    </main>
  );
}
