"use client";

import { UserIndicator } from "~/components/user-indicator";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background text-foreground min-h-dvh">
      <UserIndicator />
      {children}
    </div>
  );
}
