import { TRPCError } from "@trpc/server";
import { userHasRole } from "~/server/utils/roles";
import type { PrismaClient } from "~Prisma/client";

/**
 * Shared creator-profile access checks, used by both the creator profile
 * router and the upload authorizer so the two can never drift apart.
 */

export type ProfileAccessContext = {
  db: PrismaClient;
  session: { user: { id: string } } | null;
};

/** Ensure the current user can edit the given profile. */
export async function assertCanEditProfile(
  ctx: ProfileAccessContext,
  profileId: string,
): Promise<{ profileId: string; isAdmin: boolean }> {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const [profile, user] = await Promise.all([
    ctx.db.creatorProfile.findUnique({
      where: { id: profileId },
      select: { id: true, userId: true },
    }),
    ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      include: { roles: true },
    }),
  ]);
  if (!profile) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
  }
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const isAdmin = userHasRole(user, "ADMIN");
  if (!isAdmin && profile.userId !== user.id) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You cannot edit this profile",
    });
  }
  return { profileId: profile.id, isAdmin };
}

/**
 * Resolve the target profile id. If `profileId` is provided, verify admin OR
 * owner. If omitted, return the current user's own profile.
 */
export async function resolveTargetProfileId(
  ctx: ProfileAccessContext,
  profileId?: string,
): Promise<{ profileId: string; isAdmin: boolean }> {
  if (profileId) return assertCanEditProfile(ctx, profileId);
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const mine = await ctx.db.creatorProfile.findUnique({
    where: { userId: ctx.session.user.id },
    select: { id: true },
  });
  if (!mine) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No profile for this user yet. Create one first.",
    });
  }
  return { profileId: mine.id, isAdmin: false };
}
