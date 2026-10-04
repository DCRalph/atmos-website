import { NextResponse, type NextRequest } from "next/server";

import { SITE_URL } from "~/lib/seo-constants";
import { dedicatedDomainForHost } from "~/lib/short-links/domains";

/**
 * Dedicated short link domains. Every other host passes straight through.
 *
 * On a short domain:
 * - `/vol3` is the link, rewritten to `/go/<domain>/vol3`. A rewrite rather
 *   than a match on `/[slug]`, because there `/about` would be the about page.
 * - `/` goes to the main site.
 * - Deeper paths go to the same path on the main site, rather than rendering
 *   site pages under the short domain.
 */
export function proxy(request: NextRequest) {
  const domain = dedicatedDomainForHost(request.headers.get("host"));
  if (!domain) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const segment = /^\/([^/]+)\/?$/.exec(pathname)?.[1];

  if (segment) {
    return NextResponse.rewrite(
      new URL(`/go/${domain}/${segment}${search}`, request.url),
    );
  }
  return NextResponse.redirect(new URL(`${pathname}${search}`, SITE_URL));
}

export const config = {
  // Build assets and files with an extension are served as they are, so the
  // 404 page on a short domain still has its styles.
  matcher: ["/((?!_next/|api/|.*\\.).*)"],
};
