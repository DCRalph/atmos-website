import "server-only";

import { DEVELOPER_API_USER_ID } from "~/lib/developer/system-user";
import { createCaller } from "~/server/api/root";
import type { createTRPCContext } from "~/server/api/trpc";
import type { ApiCaller } from "~/server/api-keys";
import { db } from "~/server/db";

/**
 * The admin's own tRPC procedures, called on behalf of an API key.
 *
 * Writes go through here rather than straight to the database so they get
 * exactly what an edit in the admin gets: the same validation, inventory
 * locks, slug claiming, wallet pass pushes and activity logging. The bridge is
 * the one Will GPT uses.
 *
 * The caller is signed in as the Developer API system user, which
 * `loadUser` in `~/server/api/trpc` treats as an admin only while
 * `apiCaller` is set. What it may reach is the endpoint list, each behind its
 * own scope; no endpoint maps to a superadmin procedure.
 */

type Context = Awaited<ReturnType<typeof createTRPCContext>>;
type Session = NonNullable<Context["session"]>;

export type AdminCaller = ReturnType<typeof createCaller>;

export async function adminCallerFor(
  apiCaller: ApiCaller,
  headers: Headers,
): Promise<AdminCaller> {
  const user = await db.user.findUnique({
    where: { id: DEVELOPER_API_USER_ID },
  });
  if (!user) {
    throw new Error(
      "The Developer API system user is missing. Apply the developer_api_v2 migration.",
    );
  }

  const now = new Date();
  const session = {
    user,
    // Never stored: it lives for one request and authenticates nothing.
    session: {
      id: `developer-api:${apiCaller.keyId ?? "legacy"}`,
      token: "",
      userId: user.id,
      expiresAt: new Date(now.getTime() + 60_000),
      createdAt: now,
      updatedAt: now,
      ipAddress: null,
      userAgent: headers.get("user-agent"),
    },
  } satisfies Session;

  return createCaller({ db, session, headers, apiCaller });
}
