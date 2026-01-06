"use client";

import { Suspense, useState } from "react";
import SlideOverMenu from "~/components/SlideOverMenu";
import { useIsMobile } from "~/hooks/use-mobile";
import { MainFooter } from "~/components/mainFooter";
import { UserIndicator } from "~/components/user-indicator";
import { HomeTopContent } from "~/components/home/home-top-content";
import { HomeBottomContent } from "~/components/home/home-bottom-content";
import { MobileNav } from "~/components/mobile-nav";
import { AnimatePresence } from "motion/react";

function HomeContent() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <main className="h-dvh relative overflow-y-scroll overflow-x-hidden bg-black text-white" id="home-page-main">
      <UserIndicator />

      <div className={`transtion-transform duration-300 ease-out ${isMenuOpen && isMobile ? "scale-95 blur-lg z-30" : ""}`}>
        <HomeTopContent />
      </div>

      {!isMobile ? (
        <div className="w-full flex">
          <SlideOverMenu setIsMenuOpen={setIsMenuOpen} isHomePage={true} />
          <HomeBottomContent isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} isMobile={isMobile} key="2" />
        </div>
      ) : (
        // <div className={`transition-transform duration-300 ease-in-out ${isMenuOpen ? "translate-x-64" : "translate-x-0"}`}>
        //   <div className="fixed top-0 right-full z-20 h-full w-64">
        //     <SlideOverMenu setIsMenuOpen={setIsMenuOpen} isHomePage={true} />
        //   </div>
        //   {isMobile && (<MobileNav onMenuToggle={() => setIsMenuOpen(!isMenuOpen)} isMenuOpen={isMenuOpen} />)}

        //   <HomeBottomContent isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} isMobile={isMobile} key="4" />
        // </div>

        <div className="relative">
          <AnimatePresence initial={false}>
            {isMenuOpen && (
              <div className="fixed z-100 top-0 left-0">
                <SlideOverMenu setIsMenuOpen={setIsMenuOpen} isHomePage={true} />
              </div>
            )}
          </AnimatePresence>

          <div className={`transtion-transform duration-300 ease-out ${isMenuOpen ? "scale-95 blur-lg z-30" : ""}`}>
            <MobileNav onMenuToggle={() => setIsMenuOpen(!isMenuOpen)} isMenuOpen={isMenuOpen} />
            <HomeBottomContent isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} isMobile={isMobile} key="4" />
          </div>
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