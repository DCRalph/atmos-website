"use client";

import { motion } from "motion/react";
import { useMobileMenu } from "~/components/mobile-menu-provider";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

export function MobileMenuToggle() {
  const { isMenuOpen, toggleMenu } = useMobileMenu();
  const containerRef = useRef<HTMLDivElement>(null);
  const [barColor, setBarColor] = useState<"black" | "white">("white");
  const prevMenuOpenRef = useRef(isMenuOpen);
  const lockColorUntilRef = useRef<number>(0); // Timestamp when to unlock color changes

  useEffect(() => {
    const checkBackground = (force = false) => {
      // Don't detect when menu is open or color is locked
      if (isMenuOpen) return;
      if (!force && Date.now() < lockColorUntilRef.current) return;
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Temporarily hide from pointer events
      const originalPointerEvents = containerRef.current.style.pointerEvents;
      containerRef.current.style.pointerEvents = "none";

      const elementBelow = document.elementFromPoint(centerX, centerY);
      containerRef.current.style.pointerEvents = originalPointerEvents;

      if (!elementBelow) return;

      // Find background color, excluding menu elements
      let currentElement: Element | null = elementBelow;
      let bgColor: string | null = null;

      while (currentElement && !bgColor) {
        // Skip menu-related elements
        const id = currentElement.id;
        const className = currentElement.className;
        if (
          typeof className === "string" &&
          (id?.includes("menu") ||
            className.includes("menu") ||
            className.includes("slide-over") ||
            className.includes("overlay"))
        ) {
          currentElement = currentElement.parentElement;
          continue;
        }

        const style = window.getComputedStyle(currentElement);
        const bg = style.backgroundColor;
        if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
          bgColor = bg;
          break;
        }
        currentElement = currentElement.parentElement;
      }

      if (bgColor && containerRef.current) {
        const rgbMatch = bgColor.match(/\d+/g);
        if (rgbMatch && rgbMatch.length >= 3) {
          const r = parseInt(rgbMatch[0] ?? "0");
          const g = parseInt(rgbMatch[1] ?? "0");
          const b = parseInt(rgbMatch[2] ?? "0");
          const luminance = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
          
          const newColor = luminance > 0.5 ? "black" : "white";
          setBarColor(newColor);
          containerRef.current.style.setProperty("--bar-color", newColor);
        }
      }
    };

    // Detect when menu is about to open - store color before opening
    if (!prevMenuOpenRef.current && isMenuOpen) {
      // Menu is opening, detect and lock this color
      checkBackground(true);
      // Lock color for 2 seconds after menu closes
      lockColorUntilRef.current = Date.now() + 2000;
    }

    // When menu is open, don't detect (keep current color)
    if (isMenuOpen) {
      prevMenuOpenRef.current = isMenuOpen;
      return;
    }

    // When menu closes, don't detect immediately - color is locked
    // Only detect on scroll/resize after lock expires
    const timeoutId = setTimeout(() => {
      if (!isMenuOpen && Date.now() >= lockColorUntilRef.current) {
        checkBackground(true);
      }
    }, 0);

    const handleScroll = () => {
      if (!isMenuOpen) {
        requestAnimationFrame(() => checkBackground(false));
      }
    };
    
    document.addEventListener("scroll", handleScroll, { passive: true, capture: true });
    window.addEventListener("resize", () => {
      if (!isMenuOpen) {
        checkBackground(false);
      }
    });

    prevMenuOpenRef.current = isMenuOpen;

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, [isMenuOpen]);

  const topBarVariants = {
    closed: {
      rotate: 0,
      y: -10,
      width: 24,
    },
    open: {
      rotate: 45,
      y: 0,
      width: 32,
    },
  };

  const middleBarVariants = {
    closed: {
      opacity: 1,
    },
    open: {
      opacity: 0,
    },
  };

  const bottomBarVariants = {
    closed: {
      rotate: 0,
      y: 10,
      width: 24,
    },
    open: {
      rotate: -45,
      y: 0,
      width: 32,
    },
  };

  const portalContainer = document.getElementById("mobile-menu-toggle-portal");
  if (!portalContainer) return null;

  return createPortal(
    <motion.div
      ref={containerRef}
      className="fixed right-4 bottom-4 z-500 flex size-12 items-center justify-center"
      style={{ "--bar-color": barColor } as React.CSSProperties & { "--bar-color": string }}
      whileHover={{ scale: 1.1 }}
      transition={{ duration: 0.3 }}
    >
      <button
        className="flex h-12 w-12 items-center justify-center"
        onClick={toggleMenu}
      >
        <div className="relative flex h-6 w-6 items-center justify-center">
          {/* Top bar */}
          <motion.span
            className="absolute h-[3px] origin-center rounded-full"
            style={{ backgroundColor: "var(--bar-color)" }}
            variants={topBarVariants}
            animate={isMenuOpen ? "open" : "closed"}
            initial="closed"
            transition={{ duration: 0.3 }}
          />
          {/* Middle bar */}
          <motion.span
            className="absolute h-[3px] w-6 origin-center rounded-full"
            style={{ backgroundColor: "var(--bar-color)" }}
            variants={middleBarVariants}
            animate={isMenuOpen ? "open" : "closed"}
            initial="closed"
            transition={{ duration: 0.3 }}
          />
          {/* Bottom bar */}
          <motion.span
            className="absolute h-[3px] origin-center rounded-full"
            style={{ backgroundColor: "var(--bar-color)" }}
            variants={bottomBarVariants}
            animate={isMenuOpen ? "open" : "closed"}
            initial="closed"
            transition={{ duration: 0.3 }}
          />
        </div>
      </button>
    </motion.div>,
    portalContainer,
  );
}
