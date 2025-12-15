"use client";

import { Button } from "~/components/ui/button";

interface MobileNavProps {
  onMenuToggle: () => void;
}

export function MobileNav({ onMenuToggle }: MobileNavProps) {
  return (
    <nav className="sticky top-0 left-0 right-0 w-full bg-white/75 backdrop-blur dark:bg-black/50 h-16 z-50 border-b border-black/10 dark:border-white/10">
      <div className="flex items-center justify-between">
        <div className="absolute flex items-center justify-center top-0 left-2 h-16 w-16 z-30">
          <Button 
            variant="link" 
            className="text-lg uppercase text-black dark:text-white" 
            onClick={onMenuToggle}
          >
            Menu
          </Button>
        </div>
      </div>
    </nav>
  );
}

