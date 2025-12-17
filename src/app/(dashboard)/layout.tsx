"use client";

import { UserIndicator } from "~/components/user-indicator";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <UserIndicator />
      {children}
    </div>
  );
}

