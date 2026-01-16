"use client";

import Image from "next/image";
import Link from "next/link";
import { useMobileMenu } from "~/components/mobile-menu-provider";
import { GradientBlur } from "~/components/gradient-blur";

export function MobileNav() {
  const { isMenuOpen, toggleMenu } = useMobileMenu();

  return (
    <nav className="sticky top-0 right-0 left-0 z-50 h-16 w-full">
      {/* Gradient blur - extends below the nav */}
      <GradientBlur
        direction="to-bottom"
        className="absolute inset-0 -bottom-14 z-0 rotate-180"
      />

      {/* Optional: color overlay */}
      <div
        className="absolute inset-0 -bottom-8 z-0 bg-white/50 dark:bg-black/30"
        style={{
          mask: "linear-gradient(to bottom, black 50%, transparent 100%)",
          WebkitMask: "linear-gradient(to bottom, black 50%, transparent 100%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex h-full items-center justify-center px-4">
        <div className="relative h-10 w-32 sm:w-40">
          <Link href="/">
            <Image
              src="/logo/atmos-white.png"
              alt="Atmos Logo"
              fill
              className="hidden object-contain dark:block"
              sizes="(max-width: 640px) 8rem, 10rem"
            />
            <Image
              src="/logo/atmos-black.png"
              alt="Atmos Logo"
              fill
              className="block object-contain dark:hidden"
              sizes="(max-width: 640px) 8rem, 10rem"
            />
          </Link>
        </div>
      </div>
    </nav>
  );
}
