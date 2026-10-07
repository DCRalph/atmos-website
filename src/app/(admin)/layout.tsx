import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { type Metadata } from "next";
import { auth } from "~/server/auth";
import { redirectToLogin } from "~/server/auth-session";
import { db } from "~/server/db";
import { LayoutWithSideBarHeader } from "~/components/layout-with-sideBar-header";
import { DashboardSideBar } from "~/components/admin/admin-sidebar";
import { DashboardHeader } from "~/components/dash-header";
import { UnsavedChangesProvider } from "~/components/admin/unsaved-changes-provider";
import { WillGptProvider } from "~/components/admin/will-gpt/will-gpt-provider";
import {
  WillGptRail,
  WillGptToggle,
} from "~/components/admin/will-gpt/will-gpt-rail";
import { userHasPermission } from "~/server/utils/permissions";

export const metadata: Metadata = {
  title: { absolute: "Atmos Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session?.user) return redirectToLogin();

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { permissions: true },
  });

  const isAdmin = user ? userHasPermission(user, "ADMIN") : false;

  if (!isAdmin) {
    redirect("/login");
  }

  return (
    <>
      {/* <UserIndicator /> */}
      <UnsavedChangesProvider>
        <WillGptProvider>
          <LayoutWithSideBarHeader
            sidebar={<DashboardSideBar />}
            header={<DashboardHeader actions={<WillGptToggle />} />}
            aside={<WillGptRail />}
          >
            {children}
          </LayoutWithSideBarHeader>
        </WillGptProvider>
      </UnsavedChangesProvider>
    </>
  );
}
