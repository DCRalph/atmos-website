"use client";

import { RightMenuRail } from "~/components/right-menu-rail";
import { Button } from "~/components/ui/button";
import { UserIndicator } from "~/components/user-indicator";
import { useState } from "react";
import SlideOverMenu from "~/components/SlideOverMenu";
import { PopSidesBackground } from "~/components/pop-sides-background";

const menuItems = [
  { label: "HOME", href: "/", color: "bg-[#3B82F6]" }, // Bright blue
  { label: "ABOUT", href: "/about", color: "bg-[#EF4444]" }, // Bright red
  { label: "SHOP", href: "/merch", color: "bg-[#EC4899]" }, // Bright magenta/fuchsia
  { label: "GIGS", href: "/gigs", color: "bg-[#84CC16]" }, // Bright lime green
  { label: "THE CREW", href: "/crew", color: "bg-[#06B6D4]" }, // Bright cyan
  { label: "CONTACT US", href: "/contact", color: "bg-[#9CA3AF]" }, // Light gray
];

export default function MainLayout({ children }: { children: React.ReactNode }) {

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      {/* Top navigation scroller */}
      {/* <div className="fixed left-1/2 top-0 z-20 w-full -translate-x-1/2 max-w-2xl">
            <ScrollingText />
          </div> */}

      <UserIndicator  />

      {/* <PopSidesBackground /> */}

      {/* Right menu rail */}
      {/* <RightMenuRail
        className="fixed top-2 sm:top-4 right-2 sm:right-6 z-10 text-right"
      /> */}


      <div className="absolute inset-0 -z-10">

        {/* Slide-in menu from left */}
        {/* <div className={`absolute inset-0 -z-10 transition-transform duration-300 ease-in-out ${isMenuOpen ? "translate-x-64" : "translate-x-0"}`}>
          <div className="fixed top-0 right-full z-20 h-full w-64">
            <SlideOverMenu setIsMenuOpen={setIsMenuOpen} />
          </div>
          {children}
          <Button variant="default" className="absolute top-2 left-2 z-30" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            New Menu
          </Button>
        </div> */}

        {children}

      </div >
    </>
  );
}