import { cache } from "react";
import { headers } from "next/headers";
import { type User } from "~Prisma/client";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

export const authServer = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  let dbUser: User | null = null;
  if (session) {
    dbUser = await db.user.findUnique({
      where: { id: session.user.id },
    });
  }
  return {
    ...session,
    user: dbUser,
  };
});
