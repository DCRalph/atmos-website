"use client";

import Image from "next/image";
import Link from "next/link";
import { useMobileMenu } from "~/components/mobile-menu-provider";
import { GradientBlur } from "~/components/gradient-blur";

export function MobileNav() {
  const { isMenuOpen, toggleMenu } = useMobileMenu();

  return (
    <nav className="sticky top-0 left-0 right-0 w-full h-16 z-50">
      {/* Gradient blur - extends below the nav */}
      <GradientBlur
        direction="to-bottom"
        className="absolute inset-0 z-0 -bottom-14 rotate-180"
      />

      {/* Optional: color overlay */}
      <div
        className="absolute inset-0 -bottom-8 bg-white/50 dark:bg-black/30 z-0"
        style={{
          mask: "linear-gradient(to bottom, black 50%, transparent 100%)",
          WebkitMask: "linear-gradient(to bottom, black 50%, transparent 100%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex items-center justify-center h-full px-4">
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
  );
}