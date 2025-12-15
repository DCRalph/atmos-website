"use client";

import { Button } from "~/components/ui/button";
import { NewsletterSection } from "~/components/newsletter/newsletter-section";
import { UpcomingGigsSection } from "./upcoming-gigs-section";
import { LatestContentSection } from "./latest-content-section";
import { RecentGigsSection } from "./recent-gigs-section";

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

      {isMobile && (
        <nav className="sticky top-0 left-0 right-0 w-full bg-black/50 backdrop-blur h-16 z-50">
          <div className="flex items-center justify-between">
            <div className="absolute flex items-center justify-center top-0 left-2 h-16 w-16 z-30">
              <Button variant="link" className="text-lg uppercase" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                Menu
              </Button>
            </div>
          </div>
        </nav>
      )}

      <section className="relative z-10 min-h-screen px-4 py-16 sm:py-24">
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
