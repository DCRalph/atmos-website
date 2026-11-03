import { CAMPAIGN_SOURCE_LABELS } from "~/lib/ticketing/campaigns";

/**
 * Which public pages have their views counted, and what the Site tab on
 * Analytics calls them.
 *
 * Client-safe. The server checks every path against `pageOf` before keeping
 * it, so a made-up address is never stored; a new public page needs a line in
 * `SITE_PAGES` (or a pattern in `ITEM_PAGE`) before its views count.
 */

export const PAGE_GROUPS = ["site", "gigs", "events"] as const;
export type PageGroup = (typeof PAGE_GROUPS)[number];

export const PAGE_GROUP_LABELS: Record<PageGroup, string> = {
  site: "Site pages",
  gigs: "Gigs",
  events: "Ticketed events",
};

/** Every public page at a fixed address. */
const SITE_PAGES: Record<string, string> = {
  "/": "Home",
  "/gigs": "Gigs list",
  "/events": "Events list",
  "/about": "About",
  "/crew": "Crew",
  "/content": "Content",
  "/equipment": "Equipment",
  "/merch": "Merch",
  "/socials": "Socials",
  "/contact": "Contact",
  "/l": "Links",
  "/legal/privacy": "Privacy policy",
  "/legal/terms": "Terms",
  "/legal/ticket-terms": "Ticket terms",
  "/legal/donation-terms": "Donation terms",
  "/legal/kaupapa": "Kaupapa",
};

/** One page per gig, event or product: `/gigs/<slug or id>`. */
const ITEM_PAGE = /^\/(gigs|events|merch)\/([A-Za-z0-9_-]{1,120})$/;

/**
 * The page at `path`, or null if it isn't one that counts. A gig or event's
 * `key` is its slug (or a gig's id) for the server to name it by; until then
 * `name` is the key.
 */
export function pageOf(
  path: string,
): { group: PageGroup; name: string; key?: string } | null {
  const fixed = SITE_PAGES[path];
  if (fixed) return { group: "site", name: fixed };

  const [, section, key] = ITEM_PAGE.exec(path) ?? [];
  if (!key) return null;
  if (section === "merch") {
    const words = key.replace(/[-_]+/g, " ");
    return {
      group: "site",
      name: `Merch: ${words.charAt(0).toUpperCase()}${words.slice(1)}`,
    };
  }
  return { group: section === "gigs" ? "gigs" : "events", name: key, key };
}

const SOURCE_LABELS: Partial<Record<string, string>> = CAMPAIGN_SOURCE_LABELS;

/** "instagram" → "Instagram", "direct" → "Direct", "news.co.nz" as it is. */
export function sourceLabel(source: string): string {
  const known = Object.hasOwn(SOURCE_LABELS, source)
    ? SOURCE_LABELS[source]
    : undefined;
  if (known) return known;
  return source.includes(".")
    ? source
    : `${source.charAt(0).toUpperCase()}${source.slice(1)}`;
}
