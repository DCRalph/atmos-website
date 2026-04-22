"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "~/components/ui/button";
import { CreatorProfileEditor } from "~/components/creator/creator-profile-editor";

export function DashboardProfileView() {
  return (
    <div className="bg-background min-h-dvh px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1400px]">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Profile builder</h1>
        </div>
        <CreatorProfileEditor mode="self" />
      </div>
    </div>
  );
}
