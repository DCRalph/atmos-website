"use client";

import { UserIndicator } from "~/components/user-indicator";
import { MainFooter } from "~/components/mainFooter";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="relative min-h-dvh bg-background text-foreground">
        <UserIndicator />

        {/* Give pages breathing room so the fixed footer doesn't cover content */}
        <div className="min-h-dvh">
          {children}
        </div>
        <MainFooter />

      </div>
    </>
  );
}

