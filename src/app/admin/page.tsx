import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "~/lib/auth";
import { db } from "~/server/db";
import { AdminDashboard } from "./_components/admin-dashboard";

export default async function AdminPage() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  
  if (!session?.user) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user?.isAdmin) {
    redirect("/login");
  }

  return <AdminDashboard />;
}

