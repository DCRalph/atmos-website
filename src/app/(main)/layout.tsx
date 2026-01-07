"use client";

import { UserIndicator } from "~/components/user-indicator";
import { MainFooter } from "~/components/mainFooter";
// import SlideOverMenu from "~/components/SlideOverMenu";
import { useState } from "react";
import { useIsMobile } from "~/hooks/use-mobile";
import { MobileNav } from "~/components/mobile-nav";
import { AnimatePresence } from "motion/react";

import dynamic from 'next/dynamic';

const SlideOverMenu = dynamic(() => import('~/components/SlideOverMenu'), { ssr: false });

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="bg-background text-foreground h-dvh overflow-x-hidden overflow-y-scroll">
      <UserIndicator />

      {/* Give pages breathing room so the fixed footer doesn't cover content */}
      {/* <div className="flex w-full">
          <SlideOverMenu setIsMenuOpen={setIsMenuOpen} isHomePage={true} key="1" />
          {children}
        </div> */}


      {!isMobile ? ( // Desktop layout
        <div className="w-full flex">
          <SlideOverMenu setIsMenuOpen={setIsMenuOpen} isHomePage={true} />
          <div className="flex-1">
            {children}
          </div>
        </div>
      ) : ( // Mobile layout
        // <div className={`transition-transform duration-300 ease-in-out ${isMenuOpen ? "translate-x-64" : "translate-x-0"}`}>
        //   <div className="fixed top-0 right-full z-20 h-full w-64">
        //     <SlideOverMenu setIsMenuOpen={setIsMenuOpen} isHomePage={true} key="3" isOpen={isMenuOpen} />
        //   </div>
        //   <div className="flex-1 ">
        //     <MobileNav onMenuToggle={() => setIsMenuOpen(!isMenuOpen)} isMenuOpen={isMenuOpen} />
        //     {children}
        //   </div>
        // </div>

        <div className="relative">
          <AnimatePresence initial={false} mode="wait">
            {isMenuOpen && (
              <div className="fixed z-200 top-0 left-0">
                <SlideOverMenu setIsMenuOpen={setIsMenuOpen} isHomePage={true} />
              </div>
            )}
          </AnimatePresence>

          <div className={`transtion-transform duration-700 ease-in-out ${isMenuOpen ? "scale-95 blur-lg pointer-events-none" : ""}`}>
            <MobileNav onMenuToggle={() => setIsMenuOpen(!isMenuOpen)} isMenuOpen={isMenuOpen} />
            {children}
          </div>
        </div>
      )}


      <MainFooter />

    </div>
  );
}

