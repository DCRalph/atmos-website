import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { userHasPermission } from "~/server/utils/permissions";

/**
 * The profile builder and themes are for artists. The rest of the dashboard
 * (the account page) is for everyone signed in, so the check lives here rather
 * than one level up.
 */
export default async function ArtistDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user
    ? await db.user.findUnique({
        where: { id: session.user.id },
        include: { permissions: true },
      })
    : null;
  if (!user || !userHasPermission(user, "ARTIST")) redirect("/dashboard");

  return children;
}
