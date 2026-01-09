"use client";

import { Suspense } from "react";
import { useIsMobile } from "~/hooks/use-mobile";
import { MainFooter } from "~/components/mainFooter";
import { UserIndicator } from "~/components/user-indicator";
import { HomeTopContent } from "~/components/home/home-top-content";
import { HomeBottomContent } from "~/components/home/home-bottom-content";
import { MobileNav } from "~/components/mobile-nav";

import dynamic from 'next/dynamic';

const SlideOverMenu = dynamic(() => import('~/components/SlideOverMenu'), { ssr: false });

function HomeContent() {
  const isMobile = useIsMobile();

  return (
    <main className="h-dvh relative overflow-y-scroll overflow-x-hidden bg-black text-white" id="home-page-main">
      <UserIndicator />

      <HomeTopContent />

      {!isMobile ? (
        <div className="w-full flex">
          <SlideOverMenu isHomePage={true} />
          <HomeBottomContent isMobile={isMobile} key="2" />
        </div>
      ) : (
        <div className="relative">
          {/* SlideOverMenu renders through portal on mobile */}
          <SlideOverMenu isHomePage={true} />

          <MobileNav />
          <HomeBottomContent isMobile={isMobile} key="4" />
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