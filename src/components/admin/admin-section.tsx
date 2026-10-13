"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "~/lib/utils";

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
  /**
   * Where "back" goes. The arrow is drawn here, so a label is just the
   * destination — "Events", not "← Back to Events".
   */
  backLink?: { href: string; label: string };
  actions?: React.ReactNode;
  maxWidth?: "max-w-2xl" | "max-w-4xl" | "max-w-7xl";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full min-w-0 px-4 py-4 sm:px-6 sm:py-5",
        maxWidth,
      )}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          {backLink && (
            <Link
              href={backLink.href}
              className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              {backLink.label}
            </Link>
          )}
          <h1 className="text-foreground text-2xl font-bold break-words">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-muted-foreground text-sm break-words">
              {subtitle}
            </p>
          ) : null}
          {description ? (
            <p className="text-muted-foreground text-sm">{description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>

      {children}
    </div>
  );
}
