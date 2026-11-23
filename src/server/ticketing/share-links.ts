import { notFound } from "next/navigation";

import { db } from "~/server/db";

/** The event a `/share/[token]` page opens. A revoked or made-up token is a 404. */
export async function sharedEventId(token: string): Promise<string> {
  const link = await db.ticketEventShareLink.findUnique({
    where: { token },
    select: { eventId: true },
  });
  return link?.eventId ?? notFound();
}
