import "server-only";

import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { TRPCError } from "@trpc/server";

import { formatBytes } from "~/lib/uploads/validate";
import { readHtml, type WebPage } from "~/lib/web-page";

/**
 * Fetching from the open web on an admin's behalf: Will GPT reading a page
 * and pulling down an image to upload.
 *
 * The URL comes from a model, which may have read it on a page somebody else
 * wrote, so a fetch only ever reaches a public address. Every redirect hop is
 * checked again, since a public URL is free to redirect to a private one.
 */

const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;
/** Pages larger than this are read up to it. */
const MAX_PAGE_BYTES = 3 * 1024 * 1024;

/** A desktop browser's, since plenty of sites turn away anything else. */
export const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";

/** IPv4-mapped IPv6 addresses (`::ffff:127.0.0.1`) are checked against the IPv4 rules. */
const PRIVATE = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["224.0.0.0", 4],
] as const) {
  PRIVATE.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
] as const) {
  PRIVATE.addSubnet(network, prefix, "ipv6");
}

/** Why a fetch failed, in words the admin and Will GPT can act on. */
export class WebFetchError extends TRPCError {
  constructor(message: string) {
    super({ code: "BAD_REQUEST", message });
  }
}

async function assertPublic(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new WebFetchError(`Only http and https links can be fetched.`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await lookup(host, { all: true }).catch(() => {
        throw new WebFetchError(`${host} could not be found.`);
      });
  for (const { address, family } of addresses) {
    if (PRIVATE.check(address, family === 6 ? "ipv6" : "ipv4")) {
      throw new WebFetchError(`${host} is not a public address.`);
    }
  }
}

/** `fetch`, limited to public addresses, following redirects by hand. */
export async function publicFetch(
  url: string,
  init: { headers?: Record<string, string> } = {},
): Promise<Response> {
  let current: URL;
  try {
    current = new URL(url);
  } catch {
    throw new WebFetchError(`"${url}" is not a URL.`);
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(current);
    const response = await fetch(current, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": BROWSER_USER_AGENT, ...init.headers },
    }).catch(() => {
      throw new WebFetchError(`${current.hostname} did not answer.`);
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(location, current);
      continue;
    }
    return response;
  }
  throw new WebFetchError("Too many redirects.");
}

/** The body, or as much of it as fits in `maxBytes` when `truncate` is set. */
async function readBody(
  response: Response,
  maxBytes: number,
  truncate: boolean,
): Promise<Buffer> {
  const declared = Number(response.headers.get("content-length"));
  if (!truncate && declared > maxBytes) {
    await response.body?.cancel();
    throw new WebFetchError(
      `The file is over the ${formatBytes(maxBytes)} limit.`,
    );
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body ?? []) {
    chunks.push(chunk);
    size += chunk.length;
    if (size > maxBytes) {
      if (!truncate) {
        throw new WebFetchError(
          `The file is over the ${formatBytes(maxBytes)} limit.`,
        );
      }
      break;
    }
  }
  return Buffer.concat(chunks).subarray(0, maxBytes);
}

/** `text/html; charset=utf-8` as `text/html`. */
const mediaTypeOf = (response: Response) =>
  (response.headers.get("content-type") ?? "")
    .split(";", 1)[0]
    ?.trim()
    .toLowerCase() ?? "";

export type FetchedPage =
  | ({ url: string; kind: "html" } & WebPage)
  | { url: string; kind: "text"; text: string }
  | { url: string; kind: "image" | "other"; contentType: string };

/** A page as Will GPT reads it. Images and other files are described, not read. */
export async function readPage(url: string): Promise<FetchedPage> {
  const response = await publicFetch(url);
  if (!response.ok) {
    await response.body?.cancel();
    throw new WebFetchError(`The page answered ${response.status}.`);
  }
  // The last hop's, once `publicFetch` has followed any redirects.
  const finalUrl = response.url;
  const contentType = mediaTypeOf(response);

  if (contentType === "text/html" || contentType === "application/xhtml+xml") {
    const html = (await readBody(response, MAX_PAGE_BYTES, true)).toString();
    return { url: finalUrl, kind: "html", ...readHtml(html, finalUrl) };
  }
  if (contentType.startsWith("text/") || contentType.endsWith("json")) {
    const text = (await readBody(response, MAX_PAGE_BYTES, true)).toString();
    return { url: finalUrl, kind: "text", text };
  }
  await response.body?.cancel();
  return {
    url: finalUrl,
    kind: contentType.startsWith("image/") ? "image" : "other",
    contentType,
  };
}

/** An image's bytes, refusing anything that is not an image or is over `maxBytes`. */
export async function downloadImage(
  url: string,
  maxBytes: number,
  headers?: Record<string, string>,
): Promise<{ body: Buffer; type: string; name: string }> {
  const response = await publicFetch(url, { headers });
  if (!response.ok) {
    await response.body?.cancel();
    throw new WebFetchError(
      `The image could not be downloaded (${response.status}).`,
    );
  }
  const type = mediaTypeOf(response);
  if (!type.startsWith("image/")) {
    await response.body?.cancel();
    throw new WebFetchError(
      `That link is ${type ? `${type}, not an image` : "not an image"}. Read the page to find its image links.`,
    );
  }
  const body = await readBody(response, maxBytes, false);
  const name = new URL(url).pathname.split("/").filter(Boolean).at(-1);
  return { body, type, name: name ?? "image" };
}
