import "server-only";

import type { PrismaClient } from "~Prisma/client";
import { gigSlug } from "~/lib/gig-url";

/**
 * A gig page URL carries either the cuid or a slug of the title — see
 * `gigPath` in ~/lib/gig-url. The cuid wins; failing that, every title is
 * slugged and compared, newest night first, so a reused title resolves to the
 * most recent gig.
 */
export async function resolveGigId(
  db: PrismaClient,
  idOrSlug: string,
): Promise<string | null> {
  const byId = await db.gig.findUnique({
    where: { id: idOrSlug },
    select: { id: true },
  });
  if (byId) return byId.id;

  const gigs = await db.gig.findMany({
    select: { id: true, title: true },
    orderBy: { gigStartTime: "desc" },
  });
  return gigs.find((gig) => gigSlug(gig.title) === idOrSlug)?.id ?? null;
}
