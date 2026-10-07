import { headers } from "next/headers";
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
      <UserIndicator />
      <UnsavedChangesProvider>{children}</UnsavedChangesProvider>
    </div>
  );
}
