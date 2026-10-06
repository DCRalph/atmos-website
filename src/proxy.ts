import { NextResponse, type NextRequest } from "next/server";

import { SITE_URL } from "~/lib/seo-constants";
import { DEV_HOSTS } from "~/lib/dev-hosts";
import { isMainSiteHost, normaliseHost } from "~/lib/short-links/domains";
import { PATHNAME_HEADER } from "~/lib/login-redirect";

/**
 * Extra short link domains. The main site passes straight through, with the
 * requested path attached as a header so auth gates can send signed-out users
 * to /login and back again.
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
    const url = request.nextUrl.clone();
    url.searchParams.delete("_rsc");
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(PATHNAME_HEADER, url.pathname + url.search);
    return NextResponse.next({ request: { headers: requestHeaders } });
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
