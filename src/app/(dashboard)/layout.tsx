"use client";

import { UserIndicator } from "~/components/user-indicator";
import { UnsavedChangesProvider } from "~/components/admin/unsaved-changes-provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background text-foreground min-h-dvh">
      <UserIndicator />
      <UnsavedChangesProvider>{children}</UnsavedChangesProvider>
    </div>
  );
}
