"use client";

import { SidebarTrigger } from "./ui/sidebar";
import { Separator } from "./ui/separator";
import { cabin } from "~/lib/fonts";
import { UserDropdown } from "~/components/user-dropdown";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { authClient } from "~/lib/auth-client";
import { api } from "~/trpc/react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";

type Crumb = { href: string; label: string };

const baseLabelMap: Record<string, string> = {
  "/admin": "Admin",
  "/admin/crew": "Crew",
  "/admin/content": "Content",
  "/admin/gigs": "Gigs",
  "/admin/gig-tags": "Gig Tags",
  "/admin/merch": "Merch",
  "/admin/contact": "Contact",
  "/admin/newsletter": "Newsletter",
  "/admin/users": "Users",

  "/dashboard": "Dashboard",
};

function normalizePath(p?: string): string {
  if (!p) return "/";
  // remove query/hash, decode, remove trailing slash except for root
  const cleaned = decodeURI(p.split(/[?#]/)[0]!);
  return cleaned.length > 1 && cleaned.endsWith("/")
    ? cleaned.slice(0, -1)
    : cleaned;
}

function titleizeSegment(seg: string): string {
  return seg
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildCrumbs(pathname: string): Crumb[] {
  if (pathname === "/") return [{ href: "/", label: "Home" }];

  // Special-cased known bases (keeps nicer labels)
  const crumbs: Crumb[] = [];

  if (pathname.startsWith("/admin")) {
    crumbs.push({ href: "/admin", label: baseLabelMap["/admin"] ?? "Admin" });

    if (pathname === "/admin") return crumbs;

    // /admin/<section>/...
    const parts = pathname.split("/").filter(Boolean); // ["admin","gigs","new"]
    const section = parts[1]; // e.g. "gigs"
    if (!section) return crumbs;
    const sectionHref = `/admin/${section}`;
    crumbs.push({
      href: sectionHref,
      label: baseLabelMap[sectionHref] ?? titleizeSegment(section),
    });

    // Remaining subpath
    const rest = parts.slice(2);
    if (rest.length === 0) return crumbs;

    // Build progressive crumbs for deeper routes
    let acc = sectionHref;
    for (const seg of rest) {
      acc += `/${seg}`;
      let label = titleizeSegment(seg);

      // A couple of friendly admin labels
      if (section === "gigs" && seg === "new") label = "New";
      if (section === "gigs" && seg !== "new") label = "Manage";

      crumbs.push({ href: acc, label });
    }

    return crumbs;
  }

  if (pathname.startsWith("/dashboard")) {
    return [{ href: "/dashboard", label: baseLabelMap["/dashboard"] ?? "Dashboard" }];
  }

  // Fallback: generic path -> titleized segments
  const parts = pathname.split("/").filter(Boolean);
  let acc = "";
  for (const seg of parts) {
    acc += `/${seg}`;
    crumbs.push({ href: acc, label: titleizeSegment(seg) });
  }
  return crumbs.length ? crumbs : [{ href: pathname, label: "Page" }];
}

export function DashboardHeader() {
  const rawPath = usePathname();
  const pathname = normalizePath(rawPath);
  const { data: session } = authClient.useSession();

  // Check if we're on a user management page (/admin/users/[id])
  const userManagementMatch = pathname.match(/^\/admin\/users\/([^/]+)$/);
  const managedUserId = userManagementMatch?.[1];

  // Fetch user data if we're on a user management page
  const { data: managedUser } = api.users.getById.useQuery(
    { id: managedUserId ?? "" },
    { enabled: !!managedUserId }
  );

  // Build crumbs with dynamic label for user management
  const crumbs = buildCrumbs(pathname);

  // Replace the last crumb label with the managed user's name if available
  if (managedUser && crumbs.length > 0) {
    const lastCrumb = crumbs[crumbs.length - 1];
    if (lastCrumb && pathname.startsWith("/admin/users/") && managedUserId) {
      lastCrumb.label = managedUser.name;
    }
  }

  const lastCrumb = crumbs[crumbs.length - 1];

  return (
    <nav className="bg-background/90 sticky top-0 z-50 h-16 w-full border-b backdrop-blur-sm">
      <div className="mx-auto flex h-16 items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <SidebarTrigger size={"icon"} className="" />
          <Separator orientation="vertical" className="h-8!" />
          <div className="min-w-0">
            <Breadcrumb>
              <BreadcrumbList>
                {crumbs.map((crumb, idx) => {
                  const isLast = idx === crumbs.length - 1;
                  return (
                    <span key={crumb.href} className="contents">
                      <BreadcrumbItem>
                        {isLast ? (
                          <BreadcrumbPage className={`${cabin.className} text-2xl`}>
                            {lastCrumb?.label ?? "Page"}
                          </BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link href={crumb.href} className={`${cabin.className} text-2xl`}>
                              {crumb.label}
                            </Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                      {!isLast ? <BreadcrumbSeparator /> : null}
                    </span>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <UserDropdown detailed />
        </div>
      </div>
    </nav>
  );
}
