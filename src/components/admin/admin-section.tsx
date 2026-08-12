"use client";

import Link from "next/link";
import { Button } from "~/components/ui/button";

export function AdminSection({
  title,
  subtitle,
  description,
  backLink,
  actions,
  maxWidth = "max-w-7xl",
  children,
}: {
  title: string;
  subtitle?: string;
  description?: string;
  backLink?: { href: string; label: string };
  actions?: React.ReactNode;
  maxWidth?: "max-w-2xl" | "max-w-4xl" | "max-w-7xl";
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-5 sm:px-6 sm:py-6 lg:p-8">
      {backLink && (
        <div className="mb-3 sm:mb-4">
          <Button variant="outline" size="sm" asChild className="sm:h-9">
            <Link href={backLink.href}>{backLink.label}</Link>
          </Button>
        </div>
      )}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-8">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-foreground text-2xl font-bold break-words sm:text-3xl lg:text-4xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-muted-foreground text-sm break-words sm:text-base">
              {subtitle}
            </p>
          ) : null}
          {description ? (
            <p className="text-muted-foreground text-sm sm:text-base">
              {description}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {actions}
        </div>
      </div>

      {children}
    </div>
  );
}
