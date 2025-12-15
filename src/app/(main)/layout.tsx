"use client";

import { UserIndicator } from "~/components/user-indicator";
import { MainFooter } from "~/components/mainFooter";
import SlideOverMenu from "~/components/SlideOverMenu";
import { useState } from "react";
import { useIsMobile } from "~/hooks/use-mobile";
import { MobileNav } from "~/components/mobile-nav";

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


      {!isMobile ? (
        <div className="w-full flex">
          <SlideOverMenu setIsMenuOpen={setIsMenuOpen} isHomePage={true} key="1" />
          <div className="flex-1">
            {children}
          </div>
        </div>
      ) : (
        <div className={`transition-transform duration-300 ease-in-out ${isMenuOpen ? "translate-x-64" : "translate-x-0"}`}>
          <div className="fixed top-0 right-full z-20 h-full w-64">
            <SlideOverMenu setIsMenuOpen={setIsMenuOpen} isHomePage={true} key="3" />
          </div>
          <div className="flex-1 ">
            <MobileNav onMenuToggle={() => setIsMenuOpen(!isMenuOpen)} />
            {children}
          </div>
        </div>
      )}

      <MainFooter />

    </div>
  );
}

