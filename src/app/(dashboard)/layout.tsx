import { headers } from "next/headers";
import { ImpersonationBar } from "~/components/impersonation-bar";
import { UserIndicator } from "~/components/user-indicator";
import { UnsavedChangesProvider } from "~/components/admin/unsaved-changes-provider";
import { auth } from "~/server/auth";
import { redirectToLogin } from "~/server/auth-session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return redirectToLogin();

  return (
    <div className="bg-background text-foreground min-h-dvh">
      {session.session.impersonatedBy && (
        <ImpersonationBar user={session.user} />
      )}
      <UserIndicator />
      <UnsavedChangesProvider>{children}</UnsavedChangesProvider>
    </div>
  );
}
