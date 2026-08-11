import type { LucideIcon } from "lucide-react";
import {
  BadgePercent,
  BookOpen,
  Calendar,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Mail,
  Palette,
  Settings,
  ShoppingBag,
  Sparkles,
  Tag,
  Ticket,
  User,
  Users,
} from "lucide-react";

export type AdminNavigationItem = {
  title: string;
  description: string;
  url: string;
  icon: LucideIcon;
  keywords?: string[];
};

export type AdminNavigationGroup = {
  title: string;
  items: AdminNavigationItem[];
};

export const adminHomeItem: AdminNavigationItem = {
  title: "Dashboard",
  description: "Overview and shortcuts",
  url: "/admin",
  icon: LayoutDashboard,
};

export const adminNavigationGroups: AdminNavigationGroup[] = [
  {
    title: "Content & site",
    items: [
      {
        title: "Content",
        description:
          "Manage posts and videos, and reorder the home page selection",
        url: "/admin/content",
        icon: BookOpen,
        keywords: ["posts", "videos", "homepage", "featured", "reorder"],
      },
      {
        title: "Gigs",
        description:
          "Manage upcoming and past gigs, and reorder the home page selection",
        url: "/admin/gigs",
        icon: Calendar,
        keywords: ["homepage", "featured", "reorder"],
      },
      {
        title: "Gig tags",
        description: "Organise gigs with reusable tags",
        url: "/admin/gig-tags",
        icon: Tag,
      },
      {
        title: "Media files",
        description: "Browse and manage uploaded media",
        url: "/admin/files",
        icon: FolderOpen,
        keywords: ["uploads", "images", "assets"],
      },
    ],
  },
  {
    title: "Events & sales",
    items: [
      {
        title: "Ticketed events",
        description: "Manage events, ticket tiers, orders, and door staff",
        url: "/admin/events",
        icon: Ticket,
        keywords: ["orders", "tickets", "door"],
      },
      {
        title: "Discount codes",
        description: "Create and manage ticket discount codes",
        url: "/admin/discount-codes",
        icon: BadgePercent,
        keywords: ["promotions", "coupons"],
      },
      {
        title: "Merch",
        description: "Sync products and control their display order",
        url: "/admin/merch",
        icon: ShoppingBag,
        keywords: ["shopify", "products"],
      },
      {
        title: "Rentals",
        description: "Manage gear available for rental",
        url: "/admin/rentals",
        icon: ShoppingBag,
        keywords: ["equipment", "gear"],
      },
    ],
  },
  {
    title: "People & access",
    items: [
      {
        title: "Crew",
        description: "Manage the Atmos crew directory",
        url: "/admin/crew",
        icon: Users,
        keywords: ["team"],
      },
      {
        title: "Creator profiles",
        description: "Manage public creator profiles",
        url: "/admin/creator-profiles",
        icon: Sparkles,
        keywords: ["artists"],
      },
      {
        title: "Creator claims",
        description: "Review creator profile ownership requests",
        url: "/admin/creator-profiles/claims",
        icon: User,
        keywords: ["requests", "approvals"],
      },
      {
        title: "Creator themes",
        description: "Build and manage profile themes",
        url: "/admin/creator-themes",
        icon: Palette,
      },
      {
        title: "Users",
        description: "Manage accounts and permissions",
        url: "/admin/users",
        icon: Users,
        keywords: ["roles", "accounts"],
      },
    ],
  },
  {
    title: "Messages",
    items: [
      {
        title: "Contact",
        description: "Review contact form submissions",
        url: "/admin/contact",
        icon: Mail,
        keywords: ["inbox", "enquiries"],
      },
      {
        title: "Newsletter",
        description: "Manage newsletter subscribers",
        url: "/admin/newsletter",
        icon: Mail,
        keywords: ["email", "signups"],
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        title: "Activity logs",
        description: "Review administrative account activity",
        url: "/admin/activity-logs",
        icon: FileText,
        keywords: ["audit", "history"],
      },
      {
        title: "Settings",
        description: "Configure site and ticketing defaults",
        url: "/admin/settings",
        icon: Settings,
        keywords: ["configuration"],
      },
    ],
  },
];

export const adminNavigationItems = adminNavigationGroups.flatMap(
  (group) => group.items,
);
