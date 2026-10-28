import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { auth } from "~/server/auth";
import { getUserPermissions } from "~/server/utils/permissions";

/**
 * Superadmins only. Anybody else gets a 404 rather than a refusal: the page
 * is not theirs to know about. The `developer` tRPC router checks again, so
 * this is not the only lock.
 */
export default async function DeveloperLayout({
  children,
}: LayoutProps<"/admin/developer">) {
  const session = await auth.api.getSession({ headers: await headers() });
  const permissions = session ? await getUserPermissions(session.user.id) : [];
  if (!permissions.includes("SUPERADMIN")) notFound();

  return children;
}
