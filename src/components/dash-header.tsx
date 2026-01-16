"use client";

import { SidebarTrigger } from "./ui/sidebar";
import { Separator } from "./ui/separator";
import { cabin } from "~/lib/fonts";
import { UserDropdown } from "~/components/user-dropdown";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { api } from "~/trpc/react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Crumb = { href: string; label: string; isLoading?: boolean };

type SmartCrumbResolver = {
  /** Regex pattern to match the path - must have a capture group for the ID */
  pattern: RegExp;
  /** Unique key identifying this resolver */
  key: string;
  /** Fallback label while loading or if fetch fails */
  fallbackLabel: string;
  /** Parent path to check (e.g., '/admin/users' for '/admin/users/[id]') */
  parentPath: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/** Static path-to-label mapping for known routes */
const STATIC_PATH_LABELS: Record<string, string> = {
  "/admin": "Admin",
  "/admin/crew": "Crew",
  "/admin/content": "Content",
  "/admin/gigs": "Gigs",
  "/admin/gig-tags": "Gig Tags",
  "/admin/merch": "Merch",
  "/admin/contact": "Contact",
  "/admin/newsletter": "Newsletter",
  "/admin/users": "Users",
  "/admin/files": "Files",
  "/dashboard": "Dashboard",
};

/** Smart crumb resolvers for dynamic routes */
const SMART_CRUMB_RESOLVERS: SmartCrumbResolver[] = [
  {
    pattern: /^\/admin\/users\/([^/]+)$/,
    key: "user",
    fallbackLabel: "User",
    parentPath: "/admin/users",
  },
  {
    pattern: /^\/admin\/gigs\/([^/]+)$/,
    key: "gig",
    fallbackLabel: "Gig",
    parentPath: "/admin/gigs",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

function normalizePath(p?: string): string {
  if (!p) return "/";
  const cleaned = decodeURI(p.split(/[?#]/)[0]!);
  return cleaned.length > 1 && cleaned.endsWith("/")
    ? cleaned.slice(0, -1)
    : cleaned;
}

function titleizeSegment(seg: string): string {
  return seg.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Find a matching smart crumb resolver for a given path
 */
function findSmartResolver(
  pathname: string,
): { resolver: SmartCrumbResolver; id: string } | null {
  for (const resolver of SMART_CRUMB_RESOLVERS) {
    const match = pathname.match(resolver.pattern);
    if (match?.[1]) {
      return { resolver, id: match[1] };
    }
  }
  return null;
}

/**
 * Build breadcrumbs from pathname
 */
function buildCrumbs(
  pathname: string,
  smartLabel?: { path: string; label: string; isLoading: boolean },
): Crumb[] {
  if (pathname === "/") return [{ href: "/", label: "Home" }];

  const crumbs: Crumb[] = [];

  if (pathname.startsWith("/admin")) {
    crumbs.push({
      href: "/admin",
      label: STATIC_PATH_LABELS["/admin"] ?? "Admin",
    });

    if (pathname === "/admin") return crumbs;

    const parts = pathname.split("/").filter(Boolean);
    const section = parts[1];
    if (!section) return crumbs;

    const sectionHref = `/admin/${section}`;
    crumbs.push({
      href: sectionHref,
      label: STATIC_PATH_LABELS[sectionHref] ?? titleizeSegment(section),
    });

    // Handle deeper routes
    const rest = parts.slice(2);
    if (rest.length === 0) return crumbs;

    let acc = sectionHref;
    for (const seg of rest) {
      acc += `/${seg}`;

      // Check if this segment should use a smart label
      if (smartLabel && acc === smartLabel.path) {
        crumbs.push({
          href: acc,
          label: smartLabel.label,
          isLoading: smartLabel.isLoading,
        });
      } else {
        // Fallback labels for known patterns
        let label = titleizeSegment(seg);
        if (seg === "new") label = "New";

        crumbs.push({ href: acc, label });
      }
    }

    return crumbs;
  }

  if (pathname.startsWith("/dashboard")) {
    return [
      {
        href: "/dashboard",
        label: STATIC_PATH_LABELS["/dashboard"] ?? "Dashboard",
      },
    ];
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

// ─────────────────────────────────────────────────────────────────────────────
// Smart Crumb Hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook to resolve user name from ID
 */
function useUserCrumb(userId: string | null) {
  const { data, isLoading } = api.users.getById.useQuery(
    { id: userId ?? "" },
    { enabled: !!userId },
  );
  return {
    label: data?.name ?? null,
    isLoading: !!userId && isLoading,
  };
}

/**
 * Hook to resolve gig title from ID
 */
function useGigCrumb(gigId: string | null) {
  const { data, isLoading } = api.gigs.getById.useQuery(
    { id: gigId ?? "" },
    { enabled: !!gigId && gigId !== "new" },
  );
  return {
    label: data?.title ?? null,
    isLoading: !!gigId && gigId !== "new" && isLoading,
  };
}

/**
 * Combined hook that resolves the appropriate smart crumb based on path
 */
function useSmartCrumb(pathname: string): {
  path: string;
  label: string;
  isLoading: boolean;
} | null {
  const smartMatch = findSmartResolver(pathname);

  // Determine which ID to pass to each resolver
  const userId = smartMatch?.resolver.key === "user" ? smartMatch.id : null;
  const gigId = smartMatch?.resolver.key === "gig" ? smartMatch.id : null;

  // Call all resolver hooks (React hooks must be called unconditionally)
  const userCrumb = useUserCrumb(userId);
  const gigCrumb = useGigCrumb(gigId);

  // Return the appropriate result based on which resolver matched
  if (!smartMatch) return null;

  const { resolver, id } = smartMatch;

  switch (resolver.key) {
    case "user":
      return {
        path: pathname,
        label: userCrumb.label ?? resolver.fallbackLabel,
        isLoading: userCrumb.isLoading,
      };
    case "gig":
      // Handle "new" specially
      if (id === "new") {
        return {
          path: pathname,
          label: "New Gig",
          isLoading: false,
        };
      }
      return {
        path: pathname,
        label: gigCrumb.label ?? resolver.fallbackLabel,
        isLoading: gigCrumb.isLoading,
      };
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function DashboardHeader() {
  const rawPath = usePathname();
  const pathname = normalizePath(rawPath);

  // Resolve smart crumb if applicable
  const smartLabel = useSmartCrumb(pathname);

  // Build crumbs with dynamic label support
  const crumbs = buildCrumbs(pathname, smartLabel ?? undefined);

  return (
    <nav className="bg-background/90 sticky top-0 z-50 h-16 w-full border-b backdrop-blur-sm">
      <div className="flex h-16 w-full items-center justify-between gap-4 px-4 lg:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <SidebarTrigger size={"icon"} className="shrink-0" />
          <Separator orientation="vertical" className="h-8! shrink-0" />
          <div className="min-w-0 flex-1 overflow-hidden">
            <Breadcrumb>
              <BreadcrumbList className="flex-nowrap">
                {crumbs.map((crumb, idx) => {
                  const isLast = idx === crumbs.length - 1;
                  return (
                    <span key={crumb.href} className="contents">
                      <BreadcrumbItem
                        className={`min-w-0 ${!isLast ? "shrink-0" : ""}`}
                      >
                        {isLast ? (
                          <BreadcrumbPage
                            className={`${cabin.className} truncate text-2xl text-nowrap`}
                          >
                            {crumb.isLoading ? (
                              <span className="animate-pulse">Loading...</span>
                            ) : (
                              crumb.label
                            )}
                          </BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link
                              href={crumb.href}
                              className={`${cabin.className} text-2xl text-nowrap`}
                            >
                              {crumb.label}
                            </Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                      {!isLast ? (
                        <BreadcrumbSeparator className="shrink-0" />
                      ) : null}
                    </span>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>

        <div className="right-4 flex items-center gap-4">
          <UserDropdown detailed />
        </div>
      </div>
    </nav>
  );
}
