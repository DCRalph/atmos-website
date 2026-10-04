import { serveDomainLink } from "~/server/short-links";

/**
 * Short links on an extra domain. Nobody visits this path directly:
 * `src/proxy.ts` rewrites `atms.nz/vol3` to `/go/atms.nz/vol3`, so every path
 * on that domain is a link, including ones the main site uses for pages.
 */
export const dynamic = "force-dynamic";

export default async function DomainShortLinkPage(
  props: PageProps<"/go/[host]/[slug]">,
) {
  const { host, slug } = await props.params;
  return serveDomainLink(host, slug, await props.searchParams);
}
