import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { UserIndicator } from "~/components/user-indicator";
import { UnsavedChangesProvider } from "~/components/admin/unsaved-changes-provider";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { userHasPermission } from "~/server/utils/permissions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login?next=/dashboard");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { permissions: true },
  });
  const isCreator = user ? userHasPermission(user, "CREATOR") : false;
  if (!isCreator) redirect("/");

  return (
    <div className="bg-background text-foreground min-h-dvh">
      <UserIndicator />
      <UnsavedChangesProvider>{children}</UnsavedChangesProvider>
    </div>
  );
}
