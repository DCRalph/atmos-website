import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { UserDropdown } from "~/components/user-dropdown";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { userHasPermission } from "~/server/utils/permissions";

export const metadata: Metadata = {
  title: { absolute: "Atmos Events" },
  robots: { index: false, follow: false },
};

export default async function OrganiserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login?next=/organiser/events");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { permissions: true },
  });
  const canViewEvents = user
    ? userHasPermission(user, "EVENT_ORGANISER")
    : false;
  if (!canViewEvents) redirect("/");

  return (
    <div className="bg-background text-foreground min-h-dvh">
      <header className="bg-background/90 sticky top-0 z-50 border-b backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/organiser/events" className="text-lg font-semibold">
            Atmos Events
          </Link>
          <UserDropdown />
        </div>
      </header>
      <main className="mx-auto max-w-7xl">{children}</main>
    </div>
  );
}
