"use client";

import { Suspense, useState } from "react";
import SlideOverMenu from "~/components/SlideOverMenu";
import { useIsMobile } from "~/hooks/use-mobile";
import { MainFooter } from "~/components/mainFooter";
import { UserIndicator } from "~/components/user-indicator";
import { HomeTopContent } from "~/components/home/home-top-content";
import { HomeBottomContent } from "~/components/home/home-bottom-content";

function HomeContent() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <main className="h-dvh overflow-y-scroll overflow-x-hidden bg-black text-white" id="home-page-main">
      <UserIndicator />

      <HomeTopContent />

      {!isMobile ? (
        <div className="w-full flex">
          <SlideOverMenu setIsMenuOpen={setIsMenuOpen} isHomePage={true} key="1" />
          <HomeBottomContent isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} isMobile={isMobile} key="2" />
        </div>
      ) : (
        <div className={`transition-transform duration-300 ease-in-out ${isMenuOpen ? "translate-x-64" : "translate-x-0"}`}>
          <div className="fixed top-0 right-full z-20 h-full w-64">
            <SlideOverMenu setIsMenuOpen={setIsMenuOpen} isHomePage={true} key="3" />
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