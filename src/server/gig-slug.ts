import "server-only";

import { TRPCError } from "@trpc/server";
import type { Prisma } from "~Prisma/client";
import { gigSlug } from "~/lib/gig-url";

/**
 * The slug a gig saves with: the one picked in the editor, or the title
 * slugged when none was. Two gigs never share one; a save that would is
 * refused so the admin can pick another, rather than quietly getting `-2`.
 *
 * A TBA gig keeps its slug, but nothing public sees it while it is TBA:
 * `gigParam` links it by cuid, `resolveGigId` won't match it, and `forPublic`
 * drops it from the payload.
 */
export async function claimGigSlug(
  db: Prisma.TransactionClient,
  {
    gigId,
    slug,
    title,
  }: { gigId?: string; slug?: string | null; title: string },
): Promise<string> {
  const wanted = gigSlug(slug?.trim() || title);
  if (!wanted) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The URL needs at least one letter or number.",
    });
  }

  const clash = await db.gig.findFirst({
    where: { slug: wanted, ...(gigId ? { id: { not: gigId } } : {}) },
    select: { title: true },
  });
  if (clash) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `/gigs/${wanted} is already used by "${clash.title}". Pick another URL.`,
    });
  }
  return wanted;
}
