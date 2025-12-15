"use client";

import { Button } from "~/components/ui/button";
import { PanelLeftIcon, X } from "lucide-react";

interface MobileNavProps {
  onMenuToggle: () => void;
  isMenuOpen: boolean;
}

export function MobileNav({ onMenuToggle, isMenuOpen }: MobileNavProps) {
  return (
    <nav className="sticky top-0 left-0 right-0 w-full bg-white/75 backdrop-blur dark:bg-black/50 h-16 z-50 border-b border-black/10 dark:border-white/10">
      <div className="flex items-center justify-between h-full px-4">
        {/* <div className="absolute flex items-center justify-center top-0 left-2 h-16 w-16 z-30"> */}
        <Button
          variant="ghost"
          className="text-lg uppercase  text-black dark:text-white group"
          onClick={onMenuToggle}
        >
          <div className="flex items-center gap-2 group-hover:border-b-2 group-hover:border-black dark:group-hover:border-white transition-colors">
            {!isMenuOpen && <PanelLeftIcon />}
            {isMenuOpen && <X />}
            Menu
          </div>
        </Button>
        {/* </div> */}
      </div>
    </nav>
  );
}

