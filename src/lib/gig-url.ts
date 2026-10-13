/**
 * Pretty gig URLs.
 *
 * A gig is linked by its stored slug (`/gigs/night-moves`) and the page
 * resolves either that or the cuid — see `resolveGigId` — so cuid links never
 * break. The slug is picked in the editor or made from the title when the gig
 * is first saved, and stays put after that; changing it moves the pretty URL.
 * Slugs are set by `claimGigSlug` in `~/server/gig-slug.ts`, which uses
 * `gigSlug` below.
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
 * What goes after `/gigs/` for this gig: its slug, or the cuid when it is TBA
 * (the slug would give its title away) or has none. Also
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
