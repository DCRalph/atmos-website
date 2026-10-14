import { readClient } from "~/lib/short-links/clicks";

/**
 * What a public request says about the browser behind it. Shared by checkout
 * and the event page's view count, so an order and the visit that led to it
 * describe the device the same way.
 */

/** Phone, tablet or computer, and its OS. Null when the browser didn't say. */
export function buyerClient(headers: Headers) {
  const { device, os } = readClient(
    headers.get("user-agent") ?? "",
    headers.get("sec-ch-ua-mobile"),
  );
  return device === "unknown" || device === "bot" ? null : { device, os };
}

/** Crawlers and link previewers, which should count for nothing. */
export function isBot(headers: Headers) {
  return (
    readClient(headers.get("user-agent") ?? "", headers.get("sec-ch-ua-mobile"))
      .device === "bot"
  );
}

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}
