"use client";

import { Button } from "~/components/ui/button";
import { NewsletterSection } from "~/components/home/newsletter-section";
import { UpcomingGigsSection } from "./upcoming-gigs-section";
import { LatestContentSection } from "./latest-content-section";
import { RecentGigsSection } from "./recent-gigs-section";
import { MobileNav } from "../mobile-nav";

type HomeBottomContentProps = {
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  isMobile: boolean;
};

export function HomeBottomContent({
  isMenuOpen,
  setIsMenuOpen,
  isMobile,
}: HomeBottomContentProps) {
  return (
    <main className="relative flex-1 bg-black text-white min-h-screen ">
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
