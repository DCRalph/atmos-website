/**
 * The domains short links can live on.
 *
 * Code rather than data, because a domain only works once its DNS points here
 * and it has been added to the Vercel project, and that is a deploy anyway.
 * Keeping the list here also means every domain a link is saved under is a
 * type, not just a string.
 *
 * - `site`: the main site. Links share the root with real pages, so a slug
 *   cannot take a path the app already serves; see `RESERVED_SLUGS`.
 * - `dedicated`: a short domain that does nothing else. Every single-segment
 *   path is a link and the bare domain goes to the main site; see `src/proxy.ts`.
 *
 * Adding a short domain: point its DNS at Vercel, add it to the project, then
 * add a line here, e.g. `"atms.nz": { kind: "dedicated" }`.
 */
type LinkDomainConfig = { kind: "site" } | { kind: "dedicated" };

const DOMAINS = {
  "atmosmedia.co.nz": { kind: "site" },
} as const satisfies Record<string, LinkDomainConfig>;

export type LinkDomain = keyof typeof DOMAINS;

/** Widened, so checks against `"dedicated"` still compile while none exist. */
export const LINK_DOMAINS: Record<LinkDomain, LinkDomainConfig> = DOMAINS;

/** The domain the site's own `/[slug]` route serves links for. */
export const SITE_LINK_DOMAIN = "atmosmedia.co.nz" satisfies LinkDomain;

/** Every domain, site first, as the tuple `z.enum` wants. */
export const LINK_DOMAIN_VALUES = Object.keys(LINK_DOMAINS) as [
  LinkDomain,
  ...LinkDomain[],
];

export function isLinkDomain(value: string): value is LinkDomain {
  return Object.hasOwn(LINK_DOMAINS, value);
}

/**
 * The dedicated short domain a request's Host header names, or null for any
 * other host. Port and `www.` are ignored, so `www.atms.nz` works the same as
 * `atms.nz` once it is pointed here.
 */
export function dedicatedDomainForHost(host: string | null): LinkDomain | null {
  if (!host) return null;
  const bare = host
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/^www\./, "");
  return isLinkDomain(bare) && LINK_DOMAINS[bare].kind === "dedicated"
    ? bare
    : null;
}

/**
 * The public address of a link: what gets printed, copied and encoded into
 * QR codes. Always the real domain, never the origin the admin happens to be
 * on, so a code downloaded from localhost still works on a poster.
 *
 * `code` is a named QR code's opaque `?c=`; the redirect drops the query, so
 * none of it reaches the destination. Takes a plain string because that is
 * what a stored link carries, including one whose domain has since been
 * removed from `LINK_DOMAINS`.
 */
export function shortLinkUrl(
  domain: string,
  slug: string,
  code?: string | null,
): string {
  return `https://${domain}/${slug}${code ? `?c=${code}` : ""}`;
}
