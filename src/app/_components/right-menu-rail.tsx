"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { useState, useMemo } from "react";
import { cn } from "~/lib/utils";
import { MenuIcon } from "lucide-react";
import { api } from "~/trpc/react";

type RightMenuRailProps = {
  className?: string;
  items?: MenuItem[];
};

type MenuItem = {
  label: string;
  href: string;
};

const DEFAULT_ITEMS: MenuItem[] = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/merch" },
  // { label: "Content", href: "/content" },
  { label: "Gigs", href: "/gigs" },
  { label: "The Crew", href: "/crew" },
  { label: "Contact Us", href: "/contact" },
];

export function RightMenuRail({ className = "", items }: RightMenuRailProps) {
  const { data: user } = api.user.me.useQuery();
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  // Build menu items dynamically, adding Admin if user is admin
  const menuItems = useMemo(() => {
    const baseItems = items ?? DEFAULT_ITEMS;
    if (user?.isAdmin) {
      return [...baseItems, { label: "Admin", href: "/admin" }];
    }
    return baseItems;
  }, [items, user?.isAdmin]);

  return (
    <div className={cn("fixed top-2 sm:top-4 right-2 sm:right-6 z-20 text-right", className)}>
      {/* Menu Icon Button - Static, no animations */}
      <button
        onClick={toggleMenu}
        className="flex items-center ml-auto justify-center p-1.5 sm:p-2 rounded-full hover:bg-white/10 transition-colors duration-200 mb-3 sm:mb-4"
      >
        <MenuIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
      </button>

      {/* Menu Items - Animated in/out */}
      <AnimatePresence>
        {isOpen && (
          <motion.ul
            key="menu-list"
            className="space-y-2 sm:space-y-3 text-lg sm:text-xl font-semibold uppercase tracking-wider"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {menuItems.map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ 
                  opacity: 0, 
                  x: 20,
                  transition: {
                    duration: 0.2,
                    delay: (menuItems.length - 1 - index) * 0.03,
                    ease: "easeIn"
                  }
                }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.05,
                  ease: "easeOut"
                }}
              >
                <MenuItemComponent item={item} setIsOpen={setIsOpen} />
              </motion.div>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItemComponent({ item, setIsOpen }: { item: MenuItem, setIsOpen: (isOpen: boolean) => void }) {
  const [hovered, setHovered] = useState(false);

  const hoverColorText = "text-red-600"

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
      className="group relative cursor-pointer px-1 sm:px-2 select-none"
      variants={{
        rest: { zIndex: 0, paddingTop: 2, paddingBottom: 2 },
        hover: {
          zIndex: 10,
          paddingTop: 30,
          paddingBottom: 3,
          transition: { type: "spring", stiffness: 420, damping: 28 },
        },
      }}
    >
      <Link href={item.href} onClick={() => setIsOpen(false)} className="inline-block isolate">
        <motion.span
          animate={{
            rotate: hovered ? 5 : 0,
            scale: hovered ? 2.2 : 1,
          }}
          transition={{ type: "spring", stiffness: 420, damping: 26 }}
          className={`inline-flex items-center transition-colors duration-100 ${hovered ? hoverColorText : "text-white"}`}
          style={{ originX: 1, originY: 1 }}
        >
          {item.label}
          <span className="ml-2">+</span>
        </motion.span>
      </Link>
      {/* <motion.span
        className={`pointer-events-none absolute right-0 -bottom-1 h-[2px] w-full ${hoverColorBackground}`}
        animate={{
          opacity: hovered ? 1 : 0,
          scaleX: hovered ? 1 : 0,
          originX: 1,
        }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      /> */}
    </motion.li>
  );
}


