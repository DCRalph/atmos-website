"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "~/components/ui/sidebar";
import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  FileText,
  User,
  GraduationCap,
  Users,
  CalendarCog,
  Activity,
  Mail,
  FolderOpen,
  Tag,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "~/components/ui/sidebar";
import { useState, useEffect } from "react";
import { Skeleton } from "~/components/ui/skeleton";
import { authClient } from "~/lib/auth-client";
import Image from "next/image";

const menuItems = [
  {
    title: "Admin Dashboard",
    url: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Crew",
    url: "/admin/crew",
    icon: Users,
  },
  {
    title: "Content",
    url: "/admin/content",
    icon: BookOpen,
  },
  {
    title: "Gigs",
    url: "/admin/gigs",
    icon: Calendar,
  },
  {
    title: "Home Gigs",
    url: "/admin/home-gigs",
    icon: CalendarCog,
  },
  {
    title: "Gig Tags",
    url: "/admin/gig-tags",
    icon: Tag,
  },
  {
    title: "Media Files",
    url: "/admin/files",
    icon: FolderOpen,
  },
  {
    title: "Merch",
    url: "/admin/merch",
    icon: ShoppingBag,
  },
  {
    title: "Contact",
    url: "/admin/contact",
    icon: Mail,
  },
  {
    title: "Newsletter",
    url: "/admin/newsletter",
    icon: Mail,
  },
  {
    title: "Users",
    url: "/admin/users",
    icon: Users,
  },
];

export function DashboardSideBar() {
  const { data: session } = authClient.useSession();
  const pathname = usePathname();
  const { state, isMobile } = useSidebar();
  const [isCollapsed, setIsCollapsed] = useState(state === "collapsed");

  useEffect(() => {
    setIsCollapsed(state === "collapsed");
  }, [state]);

  const isActive = (path: string) => {
    if (path === "/admin") return pathname === "/admin";
    return pathname?.startsWith(path) ?? false;
  };

  return (
    <div className="relative h-screen">
      <Sidebar collapsible="icon" className="fixed top-0 left-0 border-r-0!">
        <SidebarHeader>
          <div
            className={`transition-all duration-300 ${isCollapsed ? "" : "p-1"} flex items-center gap-2  absolute w-60`}
          >
            <div
              className={`grid ${isCollapsed && !isMobile ? "size-8 mt-3" : "size-11"} place-items-center transition-all duration-300`}
            >
              <Image src="/android-chrome-512x512.png" alt="Atmos Logo" width={128} height={128} />
            </div>
            <div className={`${isCollapsed && !isMobile ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}>
              <p className="text-lg font-bold">Atmos Admin</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className={`no-scrollbar overflow-x-hidden overflow-y-scroll! ${isCollapsed ? "mt-10" : "mt-14"}`}>
          <SidebarGroup>
            <SidebarGroupLabel>Application</SidebarGroupLabel>
            <SidebarMenu>
              {!session ? (
                // Loading state
                <>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SidebarMenuItem key={i}>
                      <div className="flex items-center gap-2 px-2 py-2">
                        <Skeleton className="size-4 rounded" />
                        {!isCollapsed && (
                          <Skeleton className="h-4 w-32 rounded" />
                        )}
                      </div>
                    </SidebarMenuItem>
                  ))}
                </>
              ) : (
                // Loaded state
                menuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                    >
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>


      </Sidebar>
    </div>
  );
}
