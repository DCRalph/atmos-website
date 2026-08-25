/**
 * Pretty gig URLs.
 *
 * A gig is linked by a slug of its title (`/gigs/night-moves`) and the page
 * resolves either that slug or the cuid — see `gigs.getById` — so old cuid
 * links never break. The slug is derived, not stored: renaming a gig moves its
 * pretty URL, and the cuid form remains the durable fallback.
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
 * What goes after `/gigs/` for this gig: the title slug, or the cuid when
 * there is no usable slug — an empty title, or a TBA gig, whose real title is
 * a secret and whose redacted one ("TBA...") would be the same URL for every
 * unannounced gig. Also the `id` to pass to `gigs.getById`, so a card's
 * prefetch shares a cache key with the page it links to.
 */
export function gigParam(gig: {
  id: string;
  title: string;
  mode?: string | null;
}): string {
  if (gig.mode === "TO_BE_ANNOUNCED") return gig.id;
  const slug = gigSlug(gig.title);
  return slug && slug !== "tba" ? slug : gig.id;
}

/** The link to a gig's public page. */
export function gigPath(gig: Parameters<typeof gigParam>[0]): string {
  return `/gigs/${gigParam(gig)}`;
}
