import { servesMainSite } from "./domains";

/**
 * The rules a short link has to satisfy, shared by the admin form that types
 * one and the router that saves it. The form uses them to say what is wrong
 * while somebody types; the router runs them again because the form's opinion
 * of the input is not evidence.
 */

/**
 * Root paths the main site already answers on, which a slug on the site
 * domain therefore cannot take.
 *
 * Next resolves a static route before `/[slug]`, so a link saved as "about"
 * would never fire. `rules.test.ts` checks every top-level route in `src/app`
 * is listed here, so a new page cannot silently shadow a link. The last few are
 * rewrites in `next.config.js`, which the test cannot see.
 */
export const RESERVED_SLUGS = new Set([
  "about",
  "account-deleted",
  "admin",
  "api",
  "auth-error",
  "contact",
  "content",
  "artist",
  "artist-preview",
  "crew",
  "dashboard",
  "door",
  "equipment",
  "events",
  "gigs",
  "go",
  "l",
  "lifetime",
  "login",
  "merch",
  "organiser",
  "privacy",
  "receipts",
  "rental-decision",
  "reset-password",
  "socials",
  "t",
  "terms",
  "tickets",
  "ui-test",
  "verify-email",
  "wallet-debugger-preview",
  // Redirects and rewrites in next.config.js
  "creator",
  "ph",
  "fuckoffaddblocker",
  "fuckoffaddblockers",
]);

/** Lowercase letters, numbers and single dashes between them. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * What somebody typed, reduced to the form that is stored and matched.
 *
 * People paste whole URLs, leading slashes and capitals into this field. All
 * of them mean the same link, so they are normalised rather than rejected.
 */
export function normaliseSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/[^/]+/, "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\s+/g, "-");
}

/**
 * Why this slug cannot be used on this domain, or null if it can. Only links
 * that answer on the main site are kept off its pages: on an extra domain,
 * `/admin` and `/about` are free to be links.
 */
export function slugProblem(slug: string, domain: string): string | null {
  if (!slug) return "The link needs a path.";
  if (slug.length > 64) return "That path is too long.";
  if (!SLUG.test(slug)) {
    return "Use lowercase letters, numbers and dashes: my-link.";
  }
  if (servesMainSite(domain) && RESERVED_SLUGS.has(slug)) {
    return `/${slug} is already a page on the main site.`;
  }
  return null;
}

/**
 * Why this destination cannot be used, or null if it can.
 *
 * Only http and https, because anything else in a redirect is a way to hand a
 * visitor a `javascript:` or `data:` URL from a link that looks like ours. A
 * path on the main site is allowed too, which is how a link points at a page
 * here rather than at a ticketing agency.
 */
export function destinationProblem(destination: string): string | null {
  const value = destination.trim();
  if (!value) return "The link needs somewhere to go.";
  if (value.startsWith("/")) {
    return value.startsWith("//") ? "That is not a path on this site." : null;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "That is not a URL. Paste the whole thing, https and all.";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "Only http and https links can be redirected to.";
  }
  return null;
}
