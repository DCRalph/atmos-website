import "server-only";

import type { Prisma } from "~Prisma/client";
import { gigSlug } from "~/lib/gig-url";

/**
 * A gig's pretty URL is its stored `slug`: the title slugged, with `-2`, `-3`
 * and so on when another gig already has it, so a night that runs again under
 * the same name gets its own page.
 *
 * Call `syncGigSlug` after any write that can change a gig's title or TBA flag;
 * it returns the slug the gig ends up with.
 *
 * A TBA gig has no slug at all: its title is the secret, and a slug of it in a
 * public payload would give it away. It gets one when it is announced.
 */
export async function syncGigSlug(
  db: Prisma.TransactionClient,
  gigId: string,
): Promise<string | null> {
  const gig = await db.gig.findUnique({
    where: { id: gigId },
    select: { title: true, isTba: true, slug: true },
  });
  if (!gig) return null;

  const slug = gig.isTba ? null : await slugFor(db, gigId, gig.title, gig.slug);
  if (slug !== gig.slug) {
    await db.gig.update({ where: { id: gigId }, data: { slug } });
  }
  return slug;
}

/** The slug this title calls for, keeping the current one if it still fits. */
async function slugFor(
  db: Prisma.TransactionClient,
  gigId: string,
  title: string,
  current: string | null,
): Promise<string | null> {
  const base = gigSlug(title);
  // Nothing usable, or the redacted title every unannounced gig shares.
  if (!base || base === "tba") return null;
  if (current && isSlugOf(current, base)) return current;

  const taken = new Set(
    (
      await db.gig.findMany({
        where: { slug: { startsWith: base }, id: { not: gigId } },
        select: { slug: true },
      })
    ).flatMap((row) => (row.slug ? [row.slug] : [])),
  );
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** `club-vitamin` and `club-vitamin-2` are both slugs of "Club Vitamin". */
export function isSlugOf(slug: string, base: string): boolean {
  return slug === base || new RegExp(`^${base}-\\d+$`).test(slug);
}
