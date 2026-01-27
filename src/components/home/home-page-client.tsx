"use client";

import { useIsMobile } from "~/hooks/use-mobile";
import { MainFooter } from "~/components/mainFooter";
import { UserIndicator } from "~/components/user-indicator";
import { HomeTopContent } from "~/components/home/home-top-content";
import { HomeBottomContent } from "~/components/home/home-bottom-content";
import { MobileNav } from "~/components/mobile-nav";
import { MobileMenuToggle } from "~/components/mobile-menu-toggle";
import { OpeningAnimation } from "~/components/opening-animation";

import dynamic from "next/dynamic";

const SlideOverMenu = dynamic(() => import("~/components/SlideOverMenu"), {
  ssr: false,
});

export function HomePageClient() {
  const isMobile = useIsMobile();

  return (
    <main
      className="relative h-dvh overflow-x-hidden overflow-y-scroll bg-black text-white"
      id="home-page-main"
    >
      <OpeningAnimation />

      <UserIndicator />

      <HomeTopContent />

      {!isMobile ? (
        <div className="flex w-full">
          <SlideOverMenu isHomePage={true} />
          <HomeBottomContent isMobile={isMobile} key="2" />
        </div>
      ) : (
        <div className="relative">
          {/* SlideOverMenu renders through portal on mobile */}
          <SlideOverMenu isHomePage={true} />

          <MobileNav />
          <HomeBottomContent isMobile={isMobile} key="4" className="mt-4" />
          <MobileMenuToggle />
        </div>
      )}

      <MainFooter />
    </main>
  );
}
