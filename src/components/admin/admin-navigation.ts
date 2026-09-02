import type { LucideIcon } from "lucide-react";
import {
  BadgePercent,
  Bell,
  BookOpen,
  Calendar,
  FileText,
  FolderOpen,
  IdCard,
  LayoutDashboard,
  Mail,
  Palette,
  ScanLine,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Tag,
  Ticket,
  User,
  Users,
  UsersRound,
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
        title: "Door scanner",
        description: "Scan people in, sell at the door, and comp tickets",
        url: "/door",
        icon: ScanLine,
        keywords: ["door", "scan", "box office", "comp", "entry"],
      },
      {
        title: "ID checks",
        description: "People the door has checked, and everyone barred",
        url: "/admin/patrons",
        icon: IdCard,
        keywords: ["ban", "banned", "age", "underage", "id", "patron", "r18"],
      },
      {
        title: "Discount codes",
        description: "Create and manage ticket discount codes",
        url: "/admin/discount-codes",
        icon: BadgePercent,
        keywords: ["promotions", "coupons"],
      },
      {
        title: "Access levels",
        description: "What a ticket gets you past, and its colour on a pass",
        url: "/admin/access-levels",
        icon: ShieldCheck,
        keywords: ["vip", "guest list", "aaa", "artist", "crew", "backstage"],
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
        description: "Gear, packages, and booking requests",
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
        description: "The Atmos crew directory",
        url: "/admin/crew",
        icon: UsersRound,
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
        description: "Review profile ownership requests",
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
      {
        title: "Notifications",
        description: "Push to team handsets",
        url: "/admin/notifications",
        icon: Bell,
        keywords: ["push", "ntfy", "alerts", "notify"],
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        title: "Activity logs",
        description: "Every administrative action, and who took it",
        url: "/admin/activity-logs",
        icon: FileText,
        keywords: ["audit", "history"],
      },
      {
        title: "Settings",
        description: "Site configuration and the key-value store",
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
