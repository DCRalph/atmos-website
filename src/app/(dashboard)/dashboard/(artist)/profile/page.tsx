import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { DashboardProfileView } from "./view";

export const metadata = { title: "Your artist page" };

/**
 * An artist's page is edited on the page itself, so this sends them there in
 * edit mode. Artists without a page yet pick a handle here first.
 */
export default async function DashboardProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const profile = session?.user
    ? await db.artistProfile.findUnique({
        where: { userId: session.user.id },
        select: { handle: true },
      })
    : null;
  if (profile) redirect(`/artist/${profile.handle}?edit`);
  return <DashboardProfileView />;
}
