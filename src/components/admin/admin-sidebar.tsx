"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "~/components/ui/sidebar";
import {
  adminNavigationGroups,
  adminNavigationItems,
} from "./admin-navigation";

export function DashboardSideBar() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  // On mobile the sidebar is a sheet over the page, so it has to be dismissed
  // when a link is tapped or it covers the page it just navigated to.
  const closeOnMobile = () => setOpenMobile(false);
  const activeItem = adminNavigationItems
    .filter((item) =>
      item.url === "/admin"
        ? pathname === item.url
        : pathname?.startsWith(item.url),
    )
    .sort((a, b) => b.url.length - a.url.length)[0];

  const isActive = (path: string) => activeItem?.url === path;

  return (
    <Sidebar collapsible="icon" className="fixed top-0 left-0 border-r-0!">
      {/* Matches the page header plus the main column's top inset, so the
          two bottom borders line up. */}
      <SidebarHeader className="border-sidebar-border h-18 justify-center border-b p-2 group-data-[collapsible=icon]:px-1">
        <Link
          href="/admin"
          onClick={closeOnMobile}
          aria-label="Atmos Admin"
          className="focus-visible:ring-sidebar-ring flex min-w-0 items-center gap-3 rounded-lg px-2 outline-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 focus-visible:ring-2"
        >
          <Image
            src="/logo/atmos-white.png"
            alt=""
            width={5001}
            height={1120}
            priority
            className="h-6 w-auto shrink-0 group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:w-full"
          />
          <span className="text-sidebar-foreground/50 text-[10px] font-medium tracking-[0.2em] uppercase group-data-[collapsible=icon]:hidden">
            Admin
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="no-scrollbar gap-0 overflow-x-hidden py-2 group-data-[collapsible=icon]:overflow-auto group-data-[collapsible=icon]:overflow-x-hidden">
        {adminNavigationGroups.map((group) => (
          <SidebarGroup key={group.title} className="py-1">
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                      className="h-9"
                    >
                      <Link href={item.url} onClick={closeOnMobile}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-sidebar-border border-t p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="View website" className="h-9">
              <Link href="/" onClick={closeOnMobile}>
                <ExternalLink />
                <span>View website</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
