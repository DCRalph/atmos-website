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
  adminHomeItem,
  adminNavigationGroups,
  adminNavigationItems,
} from "./admin-navigation";

export function DashboardSideBar() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  // On mobile the sidebar is a sheet over the page, so it has to be dismissed
  // when a link is tapped or it covers the page it just navigated to.
  const closeOnMobile = () => setOpenMobile(false);
  const activeItem = [adminHomeItem, ...adminNavigationItems]
    .filter((item) =>
      item.url === "/admin"
        ? pathname === item.url
        : pathname?.startsWith(item.url),
    )
    .sort((a, b) => b.url.length - a.url.length)[0];

  const isActive = (path: string) => activeItem?.url === path;

  return (
    <Sidebar collapsible="icon" className="fixed top-0 left-0 border-r-0!">
      <SidebarHeader className="border-sidebar-border h-16 justify-center border-b p-2">
        <Link
          href="/admin"
          onClick={closeOnMobile}
          className="focus-visible:ring-sidebar-ring flex min-w-0 items-center gap-3 rounded-lg px-1 outline-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 focus-visible:ring-2"
        >
          <div className="bg-background grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl shadow-sm group-data-[collapsible=icon]:size-8">
            <Image
              src="/android-chrome-512x512.png"
              alt="Atmos Logo"
              width={40}
              height={40}
            />
          </div>
          <div className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold">Atmos Admin</p>
            <p className="text-sidebar-foreground/60 truncate text-xs">
              Control centre
            </p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="no-scrollbar gap-0 overflow-x-hidden py-2">
        <SidebarGroup className="pb-1">
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(adminHomeItem.url)}
                  tooltip={adminHomeItem.title}
                  className="h-9"
                >
                  <Link href={adminHomeItem.url} onClick={closeOnMobile}>
                    <adminHomeItem.icon />
                    <span>{adminHomeItem.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

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
