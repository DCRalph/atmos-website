"use client";

import { motion } from "motion/react";
import { useMobileMenu } from "~/components/mobile-menu-provider";
import { createPortal } from "react-dom";

export function MobileMenuToggle() {
  const { isMenuOpen, toggleMenu } = useMobileMenu();

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
      className="fixed z-500 bottom-4 right-4 size-12 flex items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-sm rounded-full border border-black/10 dark:border-white/10 hover:bg-white/75 dark:hover:bg-black/75"
      whileHover={{ scale: 1.1 }}
      transition={{ duration: 0.3 }}>
      <button
        className="flex h-12 w-12 items-center justify-center"
        onClick={toggleMenu}>
        <div className="relative h-6 w-6 flex items-center justify-center">
          {/* Top bar */}
          <motion.span
            className="absolute h-[3px] bg-black dark:bg-white origin-center rounded-full"
            variants={topBarVariants}
            animate={isMenuOpen ? "open" : "closed"}
            initial="closed"
            transition={{ duration: 0.3 }}
          />
          {/* Middle bar */}
          <motion.span
            className="absolute h-[3px] w-6 bg-black dark:bg-white origin-center rounded-full"
            variants={middleBarVariants}
            animate={isMenuOpen ? "open" : "closed"}
            initial="closed"
            transition={{ duration: 0.3 }}
          />
          {/* Bottom bar */}
          <motion.span
            className="absolute h-[3px] bg-black dark:bg-white origin-center rounded-full"
            variants={bottomBarVariants}
            animate={isMenuOpen ? "open" : "closed"}
            initial="closed"
            transition={{ duration: 0.3 }}
          />
        </div>
      </button>
    </motion.div>,
    portalContainer
  );
}
