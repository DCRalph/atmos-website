"use client";

import { SidebarProvider } from "~/components/ui/sidebar";

interface LayoutWithSideBarHeaderProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  header: React.ReactNode;
  /** A panel docked to the right of the content column, such as Will GPT. */
  aside?: React.ReactNode;
}

export function LayoutWithSideBarHeader({
  children,
  sidebar,
  header: header,
  aside,
}: LayoutWithSideBarHeaderProps) {
  return (
    <SidebarProvider>
      {/* Pinned to the viewport rather than sized to it: a fixed shell can't
          make the document taller, so the window never grows a scrollbar of
          its own and the content column below is the only thing that scrolls.
          Fixed also tracks the real viewport on mobile as the browser chrome
          comes and goes, which is what `h-dvh` was for. */}
      <div className="bg-sidebar fixed inset-0 flex overflow-hidden">
        {sidebar}
        {/* The inset/rounding is a desktop treatment only, and is done in CSS
            rather than JS so the first paint matches the server render. */}
        {/* `min-w-0` so a wide page shrinks to the viewport and scrolls inside
            itself, rather than stretching this column and being clipped. */}
        <div className="bg-background flex w-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto rounded-none lg:mt-2 lg:rounded-tl-xl">
          {header}
          {children}
        </div>
        {aside}
      </div>
    </SidebarProvider>
  );
}
