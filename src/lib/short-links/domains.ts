/**
 * The domains short links can live on.
 *
 * - The main site, `SITE_LINK_DOMAIN`. Links share the root with real pages,
 *   so a slug cannot take a path the app already serves; see `RESERVED_SLUGS`.
 *   An unknown path 404s like any other.
 * - Extra domains, added in the admin (`ShortLinkDomain`). Every path there is
 *   a link or nothing: any slug is allowed, and a path with no live link goes
 *   to the main site's home page; see `src/proxy.ts`.
 *
 * A link can also live on every domain at once (`ALL_DOMAINS`). That includes
 * the main site, so its slug follows the main site's rules.
 *
 * Pure, so the admin form and the router share it.
 */

/** The main site's host. A link saved under it is served by `/[slug]`. */
export const SITE_LINK_DOMAIN = "atmosmedia.co.nz";

/** Stored as a link's `domain` when it answers on every domain. */
export const ALL_DOMAINS = "*";

/**
 * Whether a link saved under `domain` answers on the main site, and so has to
 * steer clear of the main site's pages.
 */
export function servesMainSite(domain: string): boolean {
  return domain === SITE_LINK_DOMAIN || domain === ALL_DOMAINS;
}

/**
 * A host as typed or as sent in a Host header, reduced to the form domains are
 * stored and matched in: "https://WWW.Atms.nz:443/x" is "atms.nz".
 */
export function normaliseHost(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/^www\./, "");
}

const HOST = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/**
 * Hosts that are the main site itself, in any of its guises: production,
 * Vercel previews and local dev. `src/proxy.ts` lets these through untouched
 * and treats every other host as a short link domain.
 */
export function isMainSiteHost(host: string, siteUrl: string): boolean {
  const bare = normaliseHost(host);
  return (
    bare === SITE_LINK_DOMAIN ||
    bare === normaliseHost(siteUrl) ||
    bare === "localhost" ||
    bare === "127.0.0.1" ||
    bare.endsWith(".vercel.app")
  );
}

/** Why this host cannot be added as a short link domain, or null if it can. */
export function hostProblem(host: string): string | null {
  if (!host) return "Type the domain, like atms.nz.";
  if (!HOST.test(host)) return "That isn't a domain. Type it like atms.nz.";
  if (host === SITE_LINK_DOMAIN || host.endsWith(".vercel.app")) {
    return "That's the main site, which already has links.";
  }
  return null;
}

/**
 * The public address of a link on one host: what gets printed, copied and
 * encoded into QR codes. Always a real domain, never the origin the admin
 * happens to be on, so a code downloaded from localhost still works on a
 * poster.
 *
 * `code` is a named QR code's opaque `?c=`; the redirect drops the query, so
 * none of it reaches the destination.
 */
export function shortLinkUrl(
  host: string,
  slug: string,
  code?: string | null,
): string {
  return `https://${host}/${slug}${code ? `?c=${code}` : ""}`;
}

/**
 * The hosts a link answers on, main site first: one, or every domain for a
 * link saved under `ALL_DOMAINS`.
 */
export function linkHosts(domain: string, extraHosts: string[]): string[] {
  return domain === ALL_DOMAINS ? [SITE_LINK_DOMAIN, ...extraHosts] : [domain];
}

/** How a link's domain reads in the admin: a host, or "All domains". */
export function domainLabel(domain: string): string {
  return domain === ALL_DOMAINS ? "All domains" : domain;
}
