"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useState } from "react";
import { cn } from "~/lib/utils";

type RightMenuRailProps = {
  className?: string;
  items?: MenuItem[];
};

type MenuItem = {
  label: string;
  href: string;
};

const DEFAULT_ITEMS: MenuItem[] = [
  { label: "Shop", href: "/merch" },
  { label: "Content", href: "/content" },
  { label: "Tour", href: "/gigs" },
  { label: "The Crew", href: "/crew" },
  { label: "Contact Us", href: "/contact" },
];

export function RightMenuRail({ className = "", items = DEFAULT_ITEMS }: RightMenuRailProps) {
  return (
    <aside className={cn("fixed top-6 right-6 z-20 text-right", className)}>
      <motion.ul layout className="space-y-3 text-xl font-semibold uppercase tracking-wider">
        {items.map((item) => (
          <MenuItemComponent key={item.label} item={item} />
        ))}
      </motion.ul>
    </aside>
  );
}

function MenuItemComponent({ item }: { item: MenuItem }) {
  const [hovered, setHovered] = useState(false);

  const hoverColorText = "text-red-600"
  const hoverColorBackground = "bg-red-600"

  return (
    <motion.li
      key={item.label}
      layout
      initial={false}
      animate={hovered ? "hover" : "rest"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className="group relative cursor-pointer px-2"
      variants={{
        rest: { zIndex: 0, paddingTop: 3, paddingBottom: 3 },
        hover: {
          zIndex: 10,
          paddingTop: 40,
          paddingBottom: 4,
          transition: { type: "spring", stiffness: 420, damping: 28 },
        },
      }}
    >
      <Link href={item.href} className="inline-block isolate">
        <motion.span
          animate={{
            rotate: hovered ? 5 : 0,
            scale: hovered ? 2.5 : 1,
          }}
          transition={{ type: "spring", stiffness: 420, damping: 26 }}
          className={`inline-flex items-center transition-colors duration-100 ${hovered ? hoverColorText : "text-white"}`}
          style={{ originX: 1, originY: 1 }}
        >
          {item.label}
          <span className="ml-2">+</span>
        </motion.span>
      </Link>
      <motion.span
        className={`pointer-events-none absolute right-0 -bottom-1 h-[2px] w-full ${hoverColorBackground}`}
        animate={{
          opacity: hovered ? 1 : 0,
          scaleX: hovered ? 1 : 0,
          originX: 1,
        }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      />
    </motion.li>
  );
}


