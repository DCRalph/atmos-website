import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";

import { env } from "~/env";
import { SITE_URL } from "~/lib/seo-constants";
import { readClient, resolveSource } from "~/lib/short-links/clicks";
import {
  ALL_DOMAINS,
  SITE_LINK_DOMAIN,
  normaliseHost,
} from "~/lib/short-links/domains";
import { normaliseSlug } from "~/lib/short-links/rules";
import { db } from "~/server/db";

/**
 * The public half of short links: find the link a path belongs to, redirect,
 * and count the hit on the way past. The admin half is the `shortLinks` router.
 */

type SearchParams = Record<string, string | string[] | undefined>;

/** The first value of a query parameter, which is the only one that matters. */
function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

/**
 * Everything one click is read from, taken off the request in one go. It
 * exists because counting happens in `after()`, and `headers()` cannot be read
 * from there, so the plain result is carried across instead.
 */
type ClickContext = {
  userAgent: string;
  mobileHint: string | null;
  referrer: string | null;
  country: string | null;
  address: string | null;
  /** A `utm_source` or `ref` off the link, if it carried one. */
  tag: string | null;
  /** The `?c=` off a named QR code, if it carried one. */
  qrCode: string | null;
};

async function readClickContext(query: SearchParams): Promise<ClickContext> {
  const head = await headers();
  return {
    userAgent: head.get("user-agent") ?? "",
    mobileHint: head.get("sec-ch-ua-mobile"),
    referrer: head.get("referer"),
    country: head.get("x-vercel-ip-country"),
    address:
      head.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      head.get("x-real-ip"),
    tag: first(query.utm_source) ?? first(query.ref),
    qrCode: first(query.c),
  };
}

/**
 * Address and user agent together, hashed with a secret: enough to tell one
 * person opening a link twice from two people opening it once, and useless to
 * anybody reading the table later. Rotating the auth secret forgets everybody,
 * which is fine for a count.
 */
function visitorHash(address: string | null, userAgent: string) {
  return createHash("sha256")
    .update(
      [env.BETTER_AUTH_SECRET, "short-link", address ?? "", userAgent].join(
        ":",
      ),
    )
    .digest("hex")
    .slice(0, 32);
}

/**
 * Write down one hit. Runs after the redirect has gone, and swallows its own
 * failures: a link that breaks because the stats table is unhappy would be the
 * worst trade available.
 */
async function recordClick(linkId: string, host: string, click: ClickContext) {
  try {
    // A named QR code beats every other source. An unknown or deleted code
    // is just a visit.
    const qr = click.qrCode
      ? await db.shortLinkQrCode.findUnique({
          where: { linkId_code: { linkId, code: click.qrCode } },
          select: { name: true },
        })
      : null;

    await db.shortLinkClick.create({
      data: {
        linkId,
        ...readClient(click.userAgent, click.mobileHint),
        source: qr?.name ?? resolveSource(click.tag, click.referrer),
        referrer: click.referrer?.slice(0, 512) ?? null,
        country: click.country,
        domain: host,
        visitor: visitorHash(click.address, click.userAgent),
      },
    });
  } catch (error) {
    console.error("[short-links] failed to record a click", error);
  }
}

/**
 * The live link for this slug on this host. A link saved for the host itself
 * wins over one saved for every domain; the router keeps both from existing,
 * but the order here is the one that would make sense if they did.
 */
async function findLink(host: string, rawSlug: string) {
  const links = await db.shortLink.findMany({
    where: {
      slug: normaliseSlug(rawSlug),
      domain: { in: [host, ALL_DOMAINS] },
      active: true,
    },
    select: { id: true, domain: true, destination: true },
  });
  return links.find((link) => link.domain === host) ?? links[0] ?? null;
}

/** Count the click once the response has gone, then redirect. */
async function follow(
  link: { id: string; destination: string },
  host: string,
  query: SearchParams,
): Promise<never> {
  const click = await readClickContext(query);
  after(() => recordClick(link.id, host, click));

  // A path means a page on the main site. Served from another domain that
  // page does not exist there, so it is made absolute.
  const destination =
    link.destination.startsWith("/") && host !== SITE_LINK_DOMAIN
      ? new URL(link.destination, SITE_URL).toString()
      : link.destination;

  // Temporary, always: where a short link goes is meant to change, and a
  // browser that cached a permanent redirect would never ask again.
  redirect(destination);
}

/**
 * A short link on the main site, from `/[slug]`. No link is the site's own
 * 404, the same as any other mistyped path.
 */
export async function serveSiteLink(
  rawSlug: string,
  query: SearchParams,
): Promise<never> {
  const link = await findLink(SITE_LINK_DOMAIN, rawSlug);
  if (!link) notFound();
  return follow(link, SITE_LINK_DOMAIN, query);
}

/**
 * A short link on an extra domain, from `/go/[host]/[slug]`, which
 * `src/proxy.ts` rewrites every single-segment path on those domains into.
 *
 * Anything that is not a live link here, including a host nobody has added in
 * the admin, goes to the main site's home page rather than a 404: these
 * domains only exist to be links.
 */
export async function serveDomainLink(
  rawHost: string,
  rawSlug: string,
  query: SearchParams,
): Promise<never> {
  const host = normaliseHost(rawHost);
  const known = await db.shortLinkDomain.findUnique({
    where: { host },
    select: { id: true },
  });
  const link = known ? await findLink(host, rawSlug) : null;
  if (!link) redirect(new URL("/", SITE_URL).toString());
  return follow(link, host, query);
}
