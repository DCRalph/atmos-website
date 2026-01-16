"use client";

import { useEffect, useState, useRef, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";

// Extend Document interface for View Transition API
// declare global {
//   interface Document {
//     startViewTransition?: (callback: () => void | Promise<void>) => {
//       finished: Promise<void>;
//       ready: Promise<void>;
//       updateCallbackDone: Promise<void>;
//       skipTransition: () => void;
//     };
//   }
// }

export function ViewTransitionOverlay() {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showLogo, setShowLogo] = useState(false);
  const [isExploding, setIsExploding] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousPathname = useRef(pathname);

  useEffect(() => {
    // Only trigger transition if pathname actually changed
    if (previousPathname.current !== pathname) {
      previousPathname.current = pathname;

      // Reset transition state after a delay
      const timer = setTimeout(() => {
        setIsTransitioning(false);
        setShowLogo(false);
        setIsExploding(false);
      }, 800); // Wait for transition to complete (longer to allow explosion animation)

      return () => clearTimeout(timer);
    }
  }, [pathname]);

  useEffect(() => {
    // Intercept all link clicks
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a[href]");

      if (!link) return;

      const href = link.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        return;
      }

      // Check if it's an external link
      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) {
          return;
        }
      } catch {
        return;
      }

      // Don't transition if clicking the same page
      if (href === pathname) {
        return;
      }

      // Prevent default navigation
      e.preventDefault();
      e.stopPropagation();

      // Start custom transition
      if (document.startViewTransition) {
        setIsTransitioning(true);
        setShowLogo(false);

        // Fade to black
        setTimeout(() => {
          setShowLogo(true);
          // After logo shows, navigate and trigger explosion
          setTimeout(() => {
            // Trigger explosion right before navigation
            setIsExploding(true);
            document.startViewTransition?.(() => {
              startTransition(() => {
                router.push(href);
              });
            });
          }, 400);
        }, 300);
      } else {
        // Fallback for browsers without view transitions
        startTransition(() => {
          router.push(href);
        });
      }
    };

    // Use capture phase to intercept before Next.js Link handles it
    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [router, pathname, startTransition]);

  return (
    <div
      ref={overlayRef}
      className={`pointer-events-none fixed inset-0 z-[9999] transition-opacity duration-300 ${
        isTransitioning ? "opacity-100" : "opacity-0"
      }`}
      style={{
        viewTransitionName: "view-transition-overlay",
      }}
    >
      {/* Black overlay */}
      <div className="absolute inset-0 bg-black" />

      {/* Logo */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
          showLogo ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className={`relative h-16 w-64 sm:h-20 sm:w-80 ${
            isExploding ? "animate-[logo-explode_0.5s_ease-out_forwards]" : ""
          }`}
        >
          <Image
            src="/logo/atmos-white.png"
            alt="Atmos"
            fill
            className="object-contain"
            priority
            sizes="(max-width: 640px) 10rem, 12rem"
          />
        </div>
      </div>
    </div>
  );
}
