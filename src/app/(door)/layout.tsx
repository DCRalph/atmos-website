import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata, Viewport } from "next";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { userHasEffectivePermission } from "~/server/utils/permissions";

export const metadata: Metadata = {
  title: { absolute: "Atmos Door" },
  robots: { index: false, follow: false },
};

/**
 * Full-bleed, no pinch-zoom. A door phone gets held one-handed and jostled;
 * an accidental zoom mid-queue is worse than no zoom at all.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

/**
 * The scanner runs outside the site chrome entirely: no nav, no footer, no
 * menu rail. One job, one screen, big targets.
 */
export default async function DoorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login?next=/door");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { permissions: true, legacyRoles: true },
  });

  const [isAdmin, assignmentCount] = user
    ? await Promise.all([
        userHasEffectivePermission(user, "ADMIN", db),
        db.ticketEventStaff.count({ where: { userId: user.id } }),
      ])
    : [false, 0];

  const canScan = isAdmin || assignmentCount > 0;

  if (!canScan) {
    redirect("/");
  }

  return (
    <div className="min-h-dvh bg-black text-white select-none">{children}</div>
  );
}
