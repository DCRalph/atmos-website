import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

/**
 * Sign-in methods are better-auth `account` rows: one per linked social
 * provider, plus a `credential` row when the user has a password. Shared by the
 * admin user page and the user's own account page so both enforce the same
 * rules.
 */

/** The better-auth provider id of the email and password sign-in method. */
export const PASSWORD_PROVIDER = "credential";

/** A user's sign-in methods, newest first, without tokens or the password hash. */
export async function listSignInMethods(userId: string) {
  const accounts = await db.account.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      providerId: true,
      accountId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return {
    accounts,
    hasPassword: accounts.some((row) => row.providerId === PASSWORD_PROVIDER),
  };
}

/** A user's live sessions, most recently active first, without the token. */
export async function listActiveSessions(userId: string) {
  return db.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      expiresAt: true,
      ipAddress: true,
      userAgent: true,
      impersonatedBy: true,
    },
  });
}

/**
 * Removes one sign-in method, refusing to remove the last one: a user with no
 * account rows has no way back in.
 */
export async function removeSignInMethod(userId: string, accountRowId: string) {
  const accounts = await db.account.findMany({
    where: { userId },
    select: { id: true, providerId: true },
  });
  const target = accounts.find((row) => row.id === accountRowId);
  if (!target) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Sign-in method not found",
    });
  }
  if (accounts.length === 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "That is the only way to sign in to this account, so it can't be removed",
    });
  }
  await db.account.delete({ where: { id: target.id } });
  return target;
}

/**
 * Sets a user's password without knowing the old one, creating the password
 * sign-in method if they only had social ones. Admin only: users go through
 * better-auth's `changePassword` / `setPassword`, which check their session.
 */
export async function overwritePassword(userId: string, password: string) {
  const context = await auth.$context;
  const hash = await context.password.hash(password);
  const existing = await db.account.findFirst({
    where: { userId, providerId: PASSWORD_PROVIDER },
    select: { id: true },
  });

  if (existing) {
    await context.internalAdapter.updatePassword(userId, hash);
  } else {
    await context.internalAdapter.linkAccount({
      userId,
      providerId: PASSWORD_PROVIDER,
      accountId: userId,
      password: hash,
    });
  }
}

/** better-auth's default password length limits, which it enforces on its own endpoints too. */
export const passwordSchema = z
  .string()
  .min(8, "Passwords need at least 8 characters")
  .max(128, "Passwords can be at most 128 characters");
