import "server-only";

import type { Prisma, PrismaClient } from "~Prisma/client";
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
  /**
   * Narrows what may be resolved. Passed `{ status: "PUBLISHED" }` on the
   * public path, so a draft sharing a title with a live gig cannot take that
   * title's URL and make the live one unreachable.
   */
  where: Prisma.GigWhereInput = {},
): Promise<string | null> {
  const byId = await db.gig.findFirst({
    where: { ...where, id: idOrSlug },
    select: { id: true },
  });
  if (byId) return byId.id;

  const gigs = await db.gig.findMany({
    where,
    select: { id: true, title: true },
    orderBy: { gigStartTime: "desc" },
  });
  return gigs.find((gig) => gigSlug(gig.title) === idOrSlug)?.id ?? null;
}
