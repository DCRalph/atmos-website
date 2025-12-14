"use client";

import { Suspense, useState, useEffect } from "react";
import { motion } from "motion/react";
import { OpeningAnimation } from "~/components/opening-animation";
import { VideoBackground } from "~/components/video-background";
import { LiveGigPopup } from "~/components/live-gig-popup";
import { GlitchLogo } from "~/components/glitch-logo";
import { SimpleLogo } from "~/components/simple-logo";
import { SocialLinks } from "~/components/social-links";
import { ChevronDown, Loader2 } from "lucide-react";
import SlideOverMenu from "~/components/SlideOverMenu";
import { useIsMobile } from "~/hooks/use-mobile";
// import { UserIndicator } from "~/components/user-indicator";
import { Button } from "~/components/ui/button";
import { UpcomingGigCard } from "~/components/gigs/upcoming-gig-card";
import { PastGigCard } from "~/components/gigs/past-gig-card";
import { ContentItem } from "~/components/content/content-item";
import { api } from "~/trpc/react";
import { StaticBackground } from "~/components/static-background";
import { MainFooter } from "~/components/mainFooter";
import { UserIndicator } from "~/components/user-indicator";
import { NewsletterSection } from "~/components/newsletter/newsletter-section";

function HomeContent() {

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isMobile = useIsMobile();

  return (
    <main className="h-dvh overflow-y-scroll overflow-x-hidden bg-black text-white" id="home-page-main">

      <UserIndicator />

      <HomeTopContent />

      {!isMobile ? (
        <div className="w-full flex">
          <SlideOverMenu setIsMenuOpen={setIsMenuOpen} isMobile={isMobile} key="1" />
          <HomeBottomContent isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} isMobile={isMobile} key="2" />
        </div>
      ) : (


        <div className={`transition-transform duration-300 ease-in-out ${isMenuOpen ? "translate-x-64" : "translate-x-0"}`}>
          <div className="fixed top-0 right-full z-20 h-full w-64">
            <SlideOverMenu setIsMenuOpen={setIsMenuOpen} isMobile={isMobile} key="3" />
          </div>
          <HomeBottomContent isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} isMobile={isMobile} key="4" />
        </div>
      )}

      <MainFooter />

    </main>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}


function HomeTopContent() {
  return (
    <div className="h-full relative">

      <OpeningAnimation />
      <VideoBackground />

      {/* <SocialLinks className="fixed z-20" /> */}
      <LiveGigPopup />

      {/* Logo section */}
      <section className="relative flex min-h-dvh items-center justify-center px-4 z-50">
        <div className="text-center w-full max-w-[70vw] sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl">
          {/* <GlitchLogo /> */}
          <SimpleLogo />
        </div>

        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <button
            type="button"
            aria-label="Scroll to content"
            onClick={() => {
              const main = document.getElementById("home-page-main");
              if (!main) return;

              // Scroll exactly one viewport of the scroll container to reveal the next section.
              main.scrollTo({ top: main.clientHeight, behavior: "smooth" });
            }}
            className="group inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/80 backdrop-blur-sm transition hover:border-white/35 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-0"
          >
            <ChevronDown className="h-5 w-5 transition-transform duration-200 group-hover:translate-y-0.5" />
          </button>
        </motion.div>
      </section>

      <div className="absolute w-full h-32 z-10 bg-linear-to-t from-black to-transparent bottom-0 left-0" />

    </div>
  );
}

function HomeBottomContent({ isMenuOpen, setIsMenuOpen, isMobile }: { isMenuOpen: boolean; setIsMenuOpen: (open: boolean) => void; isMobile: boolean }) {
  const { data: upcomingGigs, isLoading: isLoadingUpcomingGigs } = api.gigs.getUpcoming.useQuery();
  const { data: pastGigs, isLoading: isLoadingPastGigs } = api.gigs.getPast.useQuery();
  const { data: contentItems, isLoading: isLoadingContent } = api.content.getAll.useQuery();

  // Limit past gigs to 6 most recent
  const recentPastGigs = pastGigs?.slice(0, 6) ?? [];
  // Limit content items to 3 most recent
  const recentContentItems = contentItems?.slice(0, 3) ?? [];

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

          {/* Upcoming Gigs Section */}
          <div className="mb-16 sm:mb-20">
            <h2 className="mb-6 sm:mb-8 text-2xl sm:text-3xl font-bold tracking-wide md:text-4xl border-b border-white/20 pb-3 sm:pb-4">
              Upcoming Gigs
            </h2>
            <div className="space-y-4">
              {isLoadingUpcomingGigs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-white/60" />
                </div>
              ) : upcomingGigs && upcomingGigs.filter((gig) => gig.gigStartTime).length > 0 ? (
                upcomingGigs
                  .filter((gig) => gig.gigStartTime)
                  .map((gig) => (
                    <UpcomingGigCard key={gig.id} gig={{ ...gig, gigStartTime: gig.gigStartTime! }} />
                  ))
              ) : (
                <p className="text-white/60 text-center py-8">No upcoming gigs scheduled.</p>
              )}
            </div>
          </div>

          {/* Content Items Section */}
          <div className="mb-16 sm:mb-20">
            <h2 className="mb-6 sm:mb-8 text-2xl sm:text-3xl font-bold tracking-wide md:text-4xl border-b border-white/20 pb-3 sm:pb-4">
              Latest Content
            </h2>
            <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
              {isLoadingContent ? (
                <div className="flex items-center justify-center py-8 col-span-full">
                  <Loader2 className="w-6 h-6 animate-spin text-white/60" />
                </div>
              ) : recentContentItems.length > 0 ? (
                recentContentItems.map((item) => (
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
              ) : (
                <p className="text-white/60 text-center py-8 col-span-full">No content available.</p>
              )}
            </div>
          </div>

          {/* Past Gigs Section */}
          <div>
            <h2 className="mb-6 sm:mb-8 text-2xl sm:text-3xl font-bold tracking-wide md:text-4xl border-b border-white/20 pb-3 sm:pb-4">
              Recent Gigs
            </h2>
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
              {isLoadingPastGigs ? (
                <div className="flex items-center justify-center py-8 col-span-full">
                  <Loader2 className="w-6 h-6 animate-spin text-white/60" />
                </div>
              ) : recentPastGigs.length > 0 ? (
                recentPastGigs
                  .filter((gig) => gig.gigStartTime)
                  .map((gig) => (
                    <PastGigCard key={gig.id} gig={{ ...gig, gigStartTime: gig.gigStartTime! }} />
                  ))
              ) : (
                <p className="text-white/60 text-center py-8 col-span-full">No past gigs available.</p>
              )}
            </div>
          </div>

          <NewsletterSection />
        </div>
      </section>

    </main>
  );
}