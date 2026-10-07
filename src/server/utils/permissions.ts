import { db } from "~/server/db";
import { type UserPermission } from "~Prisma/client";

export type UserWithPermissions = {
  id?: string;
  permissions?: { permission: UserPermission }[];
};

/**
 * Explicit permission check. SUPERADMIN satisfies everything; ADMIN satisfies
 * everything except SUPERADMIN, so neither needs duplicate assignment rows.
 */
export function userHasPermission(
  user: UserWithPermissions,
  permission: UserPermission,
): boolean {
  const assigned = user.permissions?.map((row) => row.permission) ?? [];
  if (assigned.includes("SUPERADMIN") || assigned.includes(permission)) {
    return true;
  }
  return permission !== "SUPERADMIN" && assigned.includes("ADMIN");
}

/** ADMIN and SUPERADMIN: the permissions only a superadmin may grant, revoke, or manage the holders of. */
export const ADMIN_TIER = [
  "ADMIN",
  "SUPERADMIN",
] as const satisfies UserPermission[];

export function isAdminTier(permissions: readonly UserPermission[]): boolean {
  return permissions.some((permission) =>
    (ADMIN_TIER as readonly UserPermission[]).includes(permission),
  );
}

export async function getUserPermissions(
  userId: string,
): Promise<UserPermission[]> {
  const assignments = await db.userPermissionAssignment.findMany({
    where: { userId },
    select: { permission: true },
  });
  return assignments.map((assignment) => assignment.permission);
}

export async function grantUserPermission(
  userId: string,
  permission: UserPermission,
  opts?: { createdBy?: string },
): Promise<void> {
  await db.userPermissionAssignment.upsert({
    where: { userId_permission: { userId, permission } },
    update: {},
    create: { userId, permission, createdBy: opts?.createdBy ?? null },
  });
}

export async function revokeUserPermission(
  userId: string,
  permission: UserPermission,
): Promise<void> {
  await db.userPermissionAssignment
    .delete({ where: { userId_permission: { userId, permission } } })
    .catch(() => undefined);
}
