"use client";

import { UserIndicator } from "~/components/user-indicator";
import { MainFooter } from "~/components/mainFooter";
import { useIsMobile } from "~/hooks/use-mobile";
import { MobileNav } from "~/components/mobile-nav";
import { MobileMenuToggle } from "~/components/mobile-menu-toggle";

import dynamic from "next/dynamic";

const SlideOverMenu = dynamic(() => import("~/components/SlideOverMenu"), {
  ssr: false,
});

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();

  return (
    <div className="bg-background text-foreground h-dvh w-full overflow-x-hidden overflow-y-scroll">
      <UserIndicator />

      {!isMobile ? ( // Desktop layout
        <div className="flex w-full">
          <SlideOverMenu isHomePage={true} />
          <div className="flex-1">{children}</div>
        </div>
      ) : (
        // Mobile layout
        <>
          <div className="">
            {/* SlideOverMenu renders through portal on mobile */}
            <SlideOverMenu isHomePage={true} />

            <MobileNav />
            {children}
            {/* <div className="flex-1">{children}</div> */}

          </div>

          <MobileMenuToggle />
        </>
      )}

      <MainFooter />
    </div>
  );
}
