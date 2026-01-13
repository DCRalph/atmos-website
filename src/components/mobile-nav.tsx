"use client";

import { Button } from "~/components/ui/button";
import { PanelLeftIcon, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMobileMenu } from "~/components/mobile-menu-provider";

export function MobileNav() {
  const { isMenuOpen, toggleMenu } = useMobileMenu();

  return (
    <>
      <nav className="sticky top-0 left-0 right-0 w-full bg-white/75 backdrop-blur dark:bg-black/50 h-16 z-50 border-b border-black/10 dark:border-white/10">
        <div className="flex items-center justify-center h-full px-4 relative">
          {/* <Button
          variant="ghost"
          className="text-lg uppercase text-black dark:text-white group absolute left-4"
          onClick={toggleMenu}
          >
          <div className="flex items-center gap-2 group-hover:border-b-2 group-hover:border-black dark:group-hover:border-white transition-colors">
          {!isMenuOpen && <PanelLeftIcon />}
          {isMenuOpen && <X />}
          Menu
          </div>
          </Button> */}

          {/* Centered Logo */}
          <div className="relative h-10 w-32 sm:w-40">
            <Link href="/">
              <Image
                src="/logo/atmos-white.png"
                alt="Atmos Logo"
                fill
                className="object-contain dark:block hidden"
                sizes="(max-width: 640px) 8rem, 10rem"
              />
              <Image
                src="/logo/atmos-black.png"
                alt="Atmos Logo"
                fill
                className="object-contain dark:hidden block"
                sizes="(max-width: 640px) 8rem, 10rem"
              />
            </Link>
          </div>
        </div>
      </nav>
    </>
  );
}

