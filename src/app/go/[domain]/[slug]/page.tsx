import { notFound } from "next/navigation";

import { isLinkDomain } from "~/lib/short-links/domains";
import { serveShortLink } from "~/server/short-links";

/**
 * Short links on a dedicated short domain. Nobody visits this path directly:
 * `src/proxy.ts` rewrites `atms.nz/vol3` to `/go/atms.nz/vol3`, so that every
 * path on that domain is a link, including ones the main site uses for pages.
 */
export const dynamic = "force-dynamic";

export default async function DomainShortLinkPage(
  props: PageProps<"/go/[domain]/[slug]">,
) {
  const { domain, slug } = await props.params;
  if (!isLinkDomain(domain)) notFound();
  return serveShortLink(domain, slug, await props.searchParams);
}
