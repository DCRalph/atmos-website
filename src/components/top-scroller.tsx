"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import Link from "next/link";

type ScrollItem = {
  label: string;
  href: string;
};

type Props = {
  items?: ScrollItem[];
  speed?: number; // pixels per second
  itemSpacing?: number; // spacing between items in pixels
  fadeWidth?: number; // width of fade zones in pixels
  className?: string;
  style?: React.CSSProperties;
};

const DEFAULT_ITEMS: ScrollItem[] = [
  { label: "Home", href: "/" },
  { label: "Gigs", href: "/gigs" },
  { label: "Content", href: "/content" },
  { label: "Merch", href: "/merch" },
  { label: "The Crew", href: "/crew" },
  { label: "Contact", href: "/contact" },
];

export function ScrollingText({
  items = DEFAULT_ITEMS,
  speed = 50,
  itemSpacing = 100,
  fadeWidth = 80,
  className,
  style,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || items.length === 0) return null;

  // Calculate total content width (rough estimate)
  const avgItemWidth = 150; // rough estimate for text width
  const totalContentWidth = items.length * (avgItemWidth + itemSpacing);

  // Animation duration based on speed
  const duration = totalContentWidth / speed;

  // Duplicate items for seamless loop
  const duplicatedItems = [...items, ...items];

  return (
    <div
      className={`relative h-[60px] w-full overflow-hidden ${className ?? ""}`}
      style={style}
    >
      {/* Left fade overlay */}
      <div
        className="pointer-events-none absolute top-0 left-0 z-10 h-full bg-gradient-to-r from-black to-transparent"
        style={{ width: `${fadeWidth}px` }}
      />

      {/* Right fade overlay */}
      <div
        className="pointer-events-none absolute top-0 right-0 z-10 h-full bg-gradient-to-l from-black to-transparent"
        style={{ width: `${fadeWidth}px` }}
      />

      <motion.div
        animate={{
          x: [0, -totalContentWidth],
        }}
        transition={{
          duration,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        className="absolute top-0 flex h-full items-center whitespace-nowrap"
      >
        {duplicatedItems.map((item, index) => (
          <Link
            key={`${item.label}-${index}`}
            href={item.href}
            className="text-lg font-medium text-white transition-colors hover:text-white/80"
            style={{ marginRight: `${itemSpacing}px` }}
          >
            {item.label}
          </Link>
        ))}
      </motion.div>
    </div>
  );
}
