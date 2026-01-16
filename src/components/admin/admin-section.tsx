"use client";

import Link from "next/link";
import { Button } from "~/components/ui/button";
import { authClient } from "~/lib/auth-client";

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
  const { data: session } = authClient.useSession();

  return (
    // <div className="p-8">
    <div className={`p-8`}>
      {backLink && (
        <div className="mb-4">
          <Button variant="outline" asChild>
            <Link href={backLink.href}>{backLink.label}</Link>
          </Button>
        </div>
      )}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-foreground text-4xl font-bold">{title}</h1>
          {subtitle ? (
            <p className="text-muted-foreground">{subtitle}</p>
          ) : null}
          {description ? (
            <p className="text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-4">{actions}</div>
      </div>

      {children}
    </div>
    // </div>
  );
}
