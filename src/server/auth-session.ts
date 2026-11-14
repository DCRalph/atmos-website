import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { type User } from "~Prisma/client";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { loginHref, PATHNAME_HEADER } from "~/lib/login-redirect";
import { userHasPermission } from "~/server/utils/permissions";

export const authServer = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  let dbUser: User | null = null;
  if (session) {
    dbUser = await db.user.findUnique({
      where: { id: session.user.id },
    });
  }
  return {
    ...session,
    user: dbUser,
  };
});

/** Send a signed-out user to /login, coming back to the page they asked for. */
export async function redirectToLogin(): Promise<never> {
  redirect(loginHref((await headers()).get(PATHNAME_HEADER)));
}

/**
 * For pages that read data themselves rather than through an admin tRPC
 * procedure: the signed-in admin, or a redirect to /login. A layout's check
 * does not cover its pages, so each of them calls this.
 */
export const requireAdmin = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return redirectToLogin();

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { permissions: true },
  });
  if (!user || !userHasPermission(user, "ADMIN")) redirect("/login");
  return user;
});
