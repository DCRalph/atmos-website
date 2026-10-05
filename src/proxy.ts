import { NextResponse, type NextRequest } from "next/server";

import { SITE_URL } from "~/lib/seo-constants";
import { DEV_HOSTS } from "~/lib/dev-hosts";
import { isMainSiteHost, normaliseHost } from "~/lib/short-links/domains";

/**
 * Extra short link domains. The main site passes straight through.
 *
 * Any other host pointed at this deployment is treated as a short link
 * domain, which is what lets domains be added from the admin without a deploy:
 * this only reads the Host header, and `/go/[host]/[slug]` checks the host is
 * one the admin added. On those domains:
 * - `/vol3` is rewritten to `/go/<host>/vol3`. A rewrite rather than a match
 *   on `/[slug]`, because there `/about` would be the about page.
 * - Everything else, `/` and deeper paths included, goes to the main site's
 *   home page. These domains never render the main site's pages.
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host");
  if (!host || isMainSiteHost(host, SITE_URL, DEV_HOSTS)) {
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;
  const segment = /^\/([^/]+)\/?$/.exec(pathname)?.[1];

  if (segment) {
    return NextResponse.rewrite(
      new URL(`/go/${normaliseHost(host)}/${segment}${search}`, request.url),
    );
  }
  return NextResponse.redirect(new URL("/", SITE_URL));
}

export const config = {
  // Build assets are left alone; every other path on an extra domain is
  // either a link or a trip to the main site.
  matcher: ["/((?!_next/).*)"],
};
