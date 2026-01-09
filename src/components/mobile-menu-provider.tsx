"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "motion/react";
import { useIsMobile } from "~/hooks/use-mobile";

interface MobileMenuContextType {
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  toggleMenu: () => void;
}

const MobileMenuContext = createContext<MobileMenuContextType | null>(null);

export function useMobileMenu() {
  const context = useContext(MobileMenuContext);
  if (!context) {
    throw new Error("useMobileMenu must be used within a MobileMenuProvider");
  }
  return context;
}

interface MobileMenuProviderProps {
  children: ReactNode;
}

export function MobileMenuProvider({ children }: MobileMenuProviderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
      setIsMenuOpen(false);
      // console.log("MobileMenuProvider: isMobile", isMobile);
  }, [isMobile]);

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((prev) => !prev);
  }, []);

  // Apply blur/scale effect to the app content when menu is open
  useEffect(() => {
    const appContent = document.getElementById("app-content-wrapper");
    if (appContent) {
      if (isMenuOpen) {
        appContent.style.transform = "scale(0.95)";
        appContent.style.filter = "blur(10px)";
        appContent.style.pointerEvents = "none";
        appContent.style.userSelect = "none";
      } else {
        appContent.style.transform = "";
        appContent.style.filter = "";
        appContent.style.pointerEvents = "";
        appContent.style.userSelect = "";
      }
    }
  }, [isMenuOpen]);

  return (
    <MobileMenuContext.Provider value={{ isMenuOpen, setIsMenuOpen, toggleMenu }}>
      {children}
    </MobileMenuContext.Provider>
  );
}

interface MobileMenuPortalProps {
  children: ReactNode;
}

export function MobileMenuPortal({ children }: MobileMenuPortalProps) {
  const [mounted, setMounted] = useState(false);
  const { isMenuOpen } = useMobileMenu();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const portalContainer = document.getElementById("mobile-menu-portal");
  if (!portalContainer) return null;

  return createPortal(
    <AnimatePresence initial={false} mode="wait">
      {isMenuOpen && children}
    </AnimatePresence>,
    portalContainer
  );
}

