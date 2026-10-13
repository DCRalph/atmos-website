/**
 * Pretty gig URLs.
 *
 * A gig is linked by its stored slug (`/gigs/night-moves`, or
 * `/gigs/night-moves-2` for the second gig of that name) and the page
 * resolves either that or the cuid — see `resolveGigId` — so cuid links never
 * break. The slug follows the title, so renaming a gig moves its pretty URL;
 * the cuid form is the durable fallback. Slugs are kept by `syncGigSlug` in
 * `~/server/gig-slug.ts`, which uses `gigSlug` below.
 */

/** "Night Moves! Vol. 2" -> "night-moves-vol-2" */
export function gigSlug(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * What goes after `/gigs/` for this gig: its slug, or the cuid when it has
 * none (a TBA gig, whose title is a secret, or one not yet backfilled). Also
 * the `id` to pass to `gigs.getById`, so a card's prefetch shares a cache key
 * with the page it links to.
 */
export function gigParam(gig: {
  id: string;
  slug: string | null;
  isTba?: boolean;
}): string {
  return !gig.isTba && gig.slug ? gig.slug : gig.id;
}

/** The link to a gig's public page. */
export function gigPath(gig: Parameters<typeof gigParam>[0]): string {
  return `/gigs/${gigParam(gig)}`;
}
