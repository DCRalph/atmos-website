import { SITE_LINK_DOMAIN } from "~/lib/short-links/domains";
import { serveShortLink } from "~/server/short-links";

/**
 * Short links on the main site, at the root: `atmosmedia.co.nz/vol3`.
 *
 * Next matches static routes before this one, so `/about` stays the about page
 * and only paths the app does not otherwise serve land here. `RESERVED_SLUGS`
 * refuses to save a slug that would be shadowed that way.
 *
 * A page rather than a route handler even though it never renders: this sits
 * under every unmatched root path, and `notFound()` from a page gives a typo the
 * site's own 404 instead of an empty body.
 */
export const dynamic = "force-dynamic";

export default async function ShortLinkPage(props: PageProps<"/[slug]">) {
  const { slug } = await props.params;
  return serveShortLink(SITE_LINK_DOMAIN, slug, await props.searchParams);
}
