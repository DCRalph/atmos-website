"use client";

import Link from "next/link";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { AdminSection } from "./admin-section";

const sections = [
  { title: "Crew", description: "Manage crew members", href: "/admin/crew" },
  {
    title: "Content",
    description: "Manage posts, videos, and more",
    href: "/admin/content",
  },
  {
    title: "Gigs",
    description: "Manage upcoming and past gigs",
    href: "/admin/gigs",
  },
  {
    title: "Gig Tags",
    description: "Create and manage gig tags",
    href: "/admin/gig-tags",
  },
  {
    title: "Merch",
    description: "Manage merchandise listings",
    href: "/admin/merch",
  },
  {
    title: "Contact",
    description: "Review contact form submissions",
    href: "/admin/contact",
  },
  {
    title: "Newsletter",
    description: "Manage newsletter signups",
    href: "/admin/newsletter",
  },
  {
    title: "Users",
    description: "Manage users and roles",
    href: "/admin/users",
  },
];

export function AdminDashboard() {
  return (
    <AdminSection
      title="Atmos Admin"
      description="Choose a section from the sidebar, or jump in below."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link key={s.href} href={s.href} className="block">
            <Card className="hover:bg-muted/50 transition-colors">
              <CardHeader>
                <CardTitle>{s.title}</CardTitle>
                <CardDescription>{s.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </AdminSection>
  );
}
