import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "~/lib/auth";
import { db } from "~/server/db";
import { UserIndicator } from "~/components/user-indicator";
import { LayoutWithSideBarHeader } from "~/components/layout-with-sideBar-header";
import { DashboardSideBar } from "~/components/admin/admin-sidebar";
import { DashboardHeader } from "~/components/dash-header";
import { UnsavedChangesProvider } from "~/components/admin/unsaved-changes-provider";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session?.user) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });

  if (user?.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <>
      {/* <UserIndicator /> */}
      <UnsavedChangesProvider>
        <LayoutWithSideBarHeader
          sidebar={<DashboardSideBar />}
          header={<DashboardHeader />}
        >
          {children}
        </LayoutWithSideBarHeader>
      </UnsavedChangesProvider>
    </>
  );
}
