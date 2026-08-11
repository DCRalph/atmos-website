import { db } from "~/server/db";
import {
  type PrismaClient,
  type UserPermission,
  type UserRole,
} from "~Prisma/client";

type PermissionDb = Pick<
  PrismaClient,
  "keyValueStore" | "userPermissionAssignment"
>;

const CUTOVER_KEY = "authorization.permissions.cutover";

export type UserWithPermissions = {
  id?: string;
  permissions?: { permission: UserPermission }[];
  legacyRoles?: { role: UserRole }[];
};

const LEGACY_PERMISSION_MAP: Partial<Record<UserPermission, UserRole>> = {
  CREATOR: "CREATOR",
  ADMIN: "ADMIN",
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

/**
 * The first explicit ADMIN permission is the cutover switch. Before it exists,
 * legacy ADMIN/CREATOR roles keep the first rollout usable so an existing admin
 * can populate the new permission table. Once it exists, legacy roles are
 * ignored permanently by authorization code.
 */
export async function isPermissionCutoverComplete(
  client: PermissionDb = db,
): Promise<boolean> {
  const state = await client.keyValueStore.findUnique({
    where: { key: CUTOVER_KEY },
    select: { value: true },
  });
  if (state?.value === "true") return true;

  const hasExplicitAdmin =
    (await client.userPermissionAssignment.count({
      where: { permission: "ADMIN" },
    })) > 0;

  if (hasExplicitAdmin) {
    await client.keyValueStore.upsert({
      where: { key: CUTOVER_KEY },
      update: { value: "true" },
      create: { key: CUTOVER_KEY, value: "true" },
    });
  }

  return hasExplicitAdmin;
}

export async function userHasEffectivePermission(
  user: UserWithPermissions,
  permission: UserPermission,
  client: PermissionDb = db,
): Promise<boolean> {
  if (userHasPermission(user, permission)) return true;
  if (await isPermissionCutoverComplete(client)) return false;

  if (user.legacyRoles?.some((row) => row.role === "ADMIN")) return true;

  const legacyRole = LEGACY_PERMISSION_MAP[permission];
  return legacyRole
    ? (user.legacyRoles?.some((row) => row.role === legacyRole) ?? false)
    : false;
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
