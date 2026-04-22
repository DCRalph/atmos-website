import { db } from "~/server/db";
import { type UserRole } from "~Prisma/client";

export type UserWithRoles = {
  id?: string;
  roles?: { role: UserRole }[];
};

/**
 * Check whether a user holds a given role. Expects the user record to have
 * been loaded with `include: { roles: true }`.
 */
export function userHasRole(user: UserWithRoles, role: UserRole): boolean {
  return user.roles?.some((r) => r.role === role) ?? false;
}

export async function getUserRoles(userId: string): Promise<UserRole[]> {
  const assignments = await db.userRoleAssignment.findMany({
    where: { userId },
    select: { role: true },
  });
  return assignments.map((a) => a.role);
}

/**
 * Add a role to a user (idempotent).
 */
export async function addUserRole(
  userId: string,
  role: UserRole,
  opts?: { createdBy?: string },
): Promise<void> {
  await db.userRoleAssignment.upsert({
    where: { userId_role: { userId, role } },
    update: {},
    create: { userId, role, createdBy: opts?.createdBy ?? null },
  });
}

/**
 * Remove a role from a user (idempotent).
 */
export async function removeUserRole(
  userId: string,
  role: UserRole,
): Promise<void> {
  await db.userRoleAssignment
    .delete({ where: { userId_role: { userId, role } } })
    .catch(() => undefined);
}
