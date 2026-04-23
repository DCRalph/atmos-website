"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "~/components/ui/button";
import { ThemeEditor } from "~/components/creator-themes/theme-editor";

export function ThemeEditPageView({ id }: { id: string }) {
  return (
    <div className="bg-background min-h-dvh px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1400px]">
        <div className="mb-4 flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/themes">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Themes
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Edit theme</h1>
        </div>
        <ThemeEditor themeId={id} mode="self" />
      </div>
    </div>
  );
}
