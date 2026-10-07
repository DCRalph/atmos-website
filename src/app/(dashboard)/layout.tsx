import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { UserIndicator } from "~/components/user-indicator";
import { UnsavedChangesProvider } from "~/components/admin/unsaved-changes-provider";
import { auth } from "~/server/auth";
import { redirectToLogin } from "~/server/auth-session";
import { db } from "~/server/db";
import { userHasPermission } from "~/server/utils/permissions";

export default async function DashboardLayout({
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
  const isArtist = user ? userHasPermission(user, "ARTIST") : false;
  if (!isArtist) redirect("/");

  return (
    <div className="bg-background text-foreground min-h-dvh">
      <UserIndicator />
      <UnsavedChangesProvider>{children}</UnsavedChangesProvider>
    </div>
  );
}
