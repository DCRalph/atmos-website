import { headers } from "next/headers";

import { linkHosts, shortLinkUrl } from "~/lib/short-links/domains";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { renderQrPng, renderQrSvg } from "~/server/ticketing/qr-image";
import { userHasPermission } from "~/server/utils/permissions";

export const dynamic = "force-dynamic";

async function isAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return false;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { permissions: true },
  });
  return !!user && userHasPermission(user, "ADMIN");
}

/**
 * A short link's QR code as a download: `?format=svg` for print, `?format=png`
 * for everything else. `?code=` picks one of its sub links; without it the
 * code is the plain link. `?host=` picks which of the link's domains it
 * encodes, for a link on every domain; without it, the first.
 *
 * Encodes the link's own domain, never the origin this was requested from, so
 * a code downloaded from localhost still works on a poster.
 */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/admin/short-links/[id]/qr">,
) {
  // 404 rather than 403: a non-admin learns nothing about which links exist.
  if (!(await isAdmin())) return new Response("Not found", { status: 404 });

  const { id } = await ctx.params;
  const query = new URL(request.url).searchParams;
  const png = query.get("format") === "png";
  const code = query.get("code");
  const requestedHost = query.get("host");

  const link = await db.shortLink.findUnique({
    where: { id },
    select: {
      domain: true,
      slug: true,
      subLinks: code ? { where: { code }, select: { name: true } } : false,
    },
  });
  const subLink = link?.subLinks?.[0];
  if (!link || (code && !subLink)) {
    return new Response("Not found", { status: 404 });
  }

  const extra = await db.shortLinkDomain.findMany({
    orderBy: { createdAt: "asc" },
    select: { host: true },
  });
  const hosts = linkHosts(
    link.domain,
    extra.map((row) => row.host),
  );
  const host = requestedHost ?? hosts[0];
  if (!host || !hosts.includes(host)) {
    return new Response("Not found", { status: 404 });
  }

  const url = shortLinkUrl(host, link.slug, { code, qr: true });
  const suffix = subLink
    ? `-${subLink.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
    : "";
  // The host goes in the name too, so two domains' codes for one link are
  // never mistaken for each other on a print proof.
  const filename = `${host}-${link.slug}${suffix}`
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+$/, "");

  const common = {
    "content-disposition": `attachment; filename="${filename}.${png ? "png" : "svg"}"`,
    "cache-control": "no-store, private",
  };

  if (png) {
    // Big enough to print A3 without the modules going soft.
    const image = await renderQrPng(url, { width: 2048 });
    return new Response(new Uint8Array(image), {
      headers: { ...common, "content-type": "image/png" },
    });
  }

  return new Response(await renderQrSvg(url), {
    headers: { ...common, "content-type": "image/svg+xml" },
  });
}
