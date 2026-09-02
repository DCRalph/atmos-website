"use client";

import { Badge } from "~/components/ui/badge";

/**
 * How a user is described in the admin — the same badge and the same wording on
 * the users list and on a single user's page, which previously kept two copies
 * of this that had already drifted.
 */

/** Providers configured in `src/server/auth.ts`, plus the password path. */
const LOGIN_METHOD_LABELS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  email: { label: "Email", variant: "default" },
  google: { label: "Google", variant: "secondary" },
};

export function LoginMethodBadge({ method }: { method: string | null }) {
  if (!method) return null;

  const config = LOGIN_METHOD_LABELS[method.toLowerCase()] ?? {
    label: method,
    variant: "outline" as const,
  };

  return (
    <Badge variant={config.variant} className="text-xs">
      {config.label}
    </Badge>
  );
}

export type PermissionName = "ADMIN" | "EVENT_ORGANISER" | "CREATOR";

/** Listed most powerful first, which is also the order badges are shown in. */
export const PERMISSIONS: {
  name: PermissionName;
  label: string;
  description: string;
  variant: "default" | "secondary" | "destructive";
}[] = [
  {
    name: "ADMIN",
    label: "Admin",
    description: "Full application administration rights.",
    variant: "destructive",
  },
  {
    name: "EVENT_ORGANISER",
    label: "Event organiser",
    description:
      "Can view every event and analytics, manage every door, scan tickets, override duplicates, and undo admissions.",
    variant: "default",
  },
  {
    name: "CREATOR",
    label: "Creator",
    description: "Can own, edit, and publish their creator profile and themes.",
    variant: "secondary",
  },
];

const PERMISSION_RANK = new Map(
  PERMISSIONS.map((permission, index) => [permission.name as string, index]),
);

export function permissionLabel(permission: string): string {
  return (
    PERMISSIONS.find((entry) => entry.name === permission)?.label ?? permission
  );
}

export function PermissionBadge({ permission }: { permission: string }) {
  const config = PERMISSIONS.find((entry) => entry.name === permission);

  return (
    <Badge
      variant={config?.variant ?? "default"}
      className="text-xs font-medium"
    >
      {config?.label ?? permission}
    </Badge>
  );
}

export function PermissionBadges({
  permissions,
}: {
  permissions: { permission: string }[] | undefined;
}) {
  const sorted = [
    ...new Set((permissions ?? []).map((row) => row.permission)),
  ].sort(
    (a, b) =>
      (PERMISSION_RANK.get(a) ?? PERMISSIONS.length) -
      (PERMISSION_RANK.get(b) ?? PERMISSIONS.length),
  );

  if (sorted.length === 0) {
    return (
      <span className="text-muted-foreground text-xs">No permissions</span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {sorted.map((permission) => (
        <PermissionBadge key={permission} permission={permission} />
      ))}
    </div>
  );
}
