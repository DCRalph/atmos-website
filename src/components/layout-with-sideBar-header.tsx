"use client";

import { SidebarProvider } from "~/components/ui/sidebar";

interface LayoutWithSideBarHeaderProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  header: React.ReactNode;
}

export function LayoutWithSideBarHeader({
  children,
  sidebar,
  header: header,
}: LayoutWithSideBarHeaderProps) {
  return (
    <SidebarProvider>
      {/* `h-dvh`, not `h-screen`: on mobile the browser chrome shrinks the
          viewport, and 100vh would push the bottom of the app out of reach. */}
      <div className="bg-sidebar flex h-dvh w-full overflow-hidden">
        {sidebar}
        {/* The inset/rounding is a desktop treatment only, and is done in CSS
            rather than JS so the first paint matches the server render. */}
        {/* `min-w-0` so a wide page shrinks to the viewport and scrolls inside
            itself, rather than stretching this column and being clipped. */}
        <div className="bg-background flex w-full min-w-0 flex-1 flex-col overflow-x-hidden rounded-none lg:mt-2 lg:rounded-tl-xl">
          {header}
          {children}
        </div>
      </div>
    </SidebarProvider>
  );
}
