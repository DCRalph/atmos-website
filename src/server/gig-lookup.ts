import "server-only";

import type { Prisma, PrismaClient } from "~Prisma/client";

/**
 * A gig page URL carries either the cuid or the gig's slug — see `gigPath` in
 * ~/lib/gig-url.
 *
 * A TBA gig has no slug, so it is only ever matched by cuid: matching on its
 * real title would let anybody confirm a guess at it.
 */
export async function resolveGigId(
  db: PrismaClient,
  idOrSlug: string,
  /**
   * Narrows what may be resolved. Passed `{ status: "PUBLISHED" }` on the
   * public path, so nothing about a draft can be confirmed from outside.
   */
  where: Prisma.GigWhereInput = {},
): Promise<string | null> {
  const gig = await db.gig.findFirst({
    where: {
      ...where,
      OR: [{ id: idOrSlug }, { slug: idOrSlug, isTba: false }],
    },
    select: { id: true },
  });
  return gig?.id ?? null;
}
