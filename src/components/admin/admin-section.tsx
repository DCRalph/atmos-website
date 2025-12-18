"use client";

import { authClient } from "~/lib/auth-client";

export function AdminSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const { data: session } = authClient.useSession();

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-4xl font-bold text-foreground">{title}</h1>
            {description ? (
              <p className="text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <p className="text-muted-foreground">
            Logged in as:{" "}
            <span className="font-bold">{session?.user?.name ?? "…"}</span>
          </p>
        </div>

        {children}
      </div>
    </div>
  );
}


