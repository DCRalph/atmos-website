import type { Metadata } from "next";
import { headers } from "next/headers";

import { auth } from "~/server/auth";
import { redirectToLogin } from "~/server/auth-session";
import { db } from "~/server/db";
import { userHasPermission } from "~/server/utils/permissions";

export const metadata: Metadata = {
  title: { absolute: "Atmos Live" },
  robots: { index: false, follow: false },
};

/**
 * Pages meant to be left up on a screen: no sidebar, header or rail, just
 * the page on black. Signed-in admins and organisers only; each procedure
 * the page calls checks the rest.
 */
export default async function ScreenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return redirectToLogin();

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { permissions: true },
  });
  const allowed =
    user &&
    (userHasPermission(user, "ADMIN") ||
      userHasPermission(user, "EVENT_ORGANISER"));
  if (!allowed) return redirectToLogin();

  return <div className="dark text-foreground bg-black">{children}</div>;
}
