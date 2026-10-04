import { headers } from "next/headers";

import { shortLinkUrl } from "~/lib/short-links/domains";
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
 * for everything else. `?code=` picks one of its named QR codes; without it the
 * code is the plain link.
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

  const link = await db.shortLink.findUnique({
    where: { id },
    select: {
      domain: true,
      slug: true,
      qrCodes: code ? { where: { code }, select: { name: true } } : false,
    },
  });
  const qr = link?.qrCodes?.[0];
  if (!link || (code && !qr)) {
    return new Response("Not found", { status: 404 });
  }

  const url = shortLinkUrl(link.domain, link.slug, code);
  const suffix = qr
    ? `-${qr.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
    : "";
  const filename = `${link.slug}${suffix}`.replace(/-+$/, "");

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
