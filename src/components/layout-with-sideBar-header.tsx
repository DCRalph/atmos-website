"use client";

import { SidebarProvider } from "~/components/ui/sidebar";
import { useIsMobile } from "~/hooks/use-mobile";
interface LayoutWithSideBarHeaderProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  header: React.ReactNode;
}

export function LayoutWithSideBarHeader({ children, sidebar, header: header }: LayoutWithSideBarHeaderProps) {

  const isMobile = useIsMobile();

  return (
    <SidebarProvider>
      <div className="bg-sidebar flex h-screen w-full">
        {sidebar}
        <div className={`flex flex-1 flex-col w-full overflow-x-hidden rounded-none bg-background ${isMobile ? "" : "mt-2 rounded-tl-xl"}`}>
          {/* <div className={`flex flex-1 flex-col w-full overflow-x-hidden rounded-none bg-background lg:mt-2 lg:rounded-tl-xl`}> */}
          {header}
          {children}
        </div>
      </div>
    </SidebarProvider>
  );
}