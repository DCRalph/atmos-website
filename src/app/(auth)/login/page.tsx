import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { userHasPermission } from "~/server/utils/permissions";
import { safeNextPath } from "~/lib/login-redirect";
import { LoginForm } from "../../../components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const next = safeNextPath((await searchParams).next);
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  // Already logged in: go where they were headed, or their home base
  if (session?.user) {
    if (next) redirect(next);
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: { permissions: true },
    });
    redirect(
      user && userHasPermission(user, "ADMIN") ? "/admin" : "/dashboard",
    );
  }

  return (
    <main className="bg-background relative flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-md">
        <LoginForm next={next} />
      </div>
    </main>
  );
}
