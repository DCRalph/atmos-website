import { db } from "~/server/db";
import { type UserPermission } from "~Prisma/client";

export type UserWithPermissions = {
  id?: string;
  permissions?: { permission: UserPermission }[];
};

/**
 * Explicit permission check. ADMIN is a full-rights permission and therefore
 * satisfies every permission check without duplicating assignment rows.
 */
export function userHasPermission(
  user: UserWithPermissions,
  permission: UserPermission,
): boolean {
  const assigned = user.permissions?.map((row) => row.permission) ?? [];
  return assigned.includes("ADMIN") || assigned.includes(permission);
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
