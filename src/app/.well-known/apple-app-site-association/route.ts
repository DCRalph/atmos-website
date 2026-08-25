/**
 * Apple's associated-domains file.
 *
 * `mobile/app.config.ts` declares `associatedDomains: ["applinks:atmosmedia.co.nz"]`,
 * and iOS only honours that if this file answers at
 * `https://atmosmedia.co.nz/.well-known/apple-app-site-association` over HTTPS,
 * as JSON, with no redirect and no `.json` extension. Until it did, every
 * ticket link Atmos emailed opened Safari instead of the app — which is the
 * one thing universal links exist to prevent.
 *
 * A route handler rather than a file in `public/` because the extensionless
 * path needs an explicit `application/json` content type, and because the
 * app identifier is derived here rather than copied into a static file that
 * nothing would ever re-check.
 */

/** Apple Developer Team ID — see `mobile/scripts/build-ipa.sh`. */
const TEAM_ID = "QB4T85D6S2";
/** Must match `ios.bundleIdentifier` in `mobile/app.config.ts`. */
const BUNDLE_ID = "nz.co.atmosmedia.app";

const APP_ID = `${TEAM_ID}.${BUNDLE_ID}`;

/**
 * What the app is allowed to take over.
 *
 * Only paths the app actually has a screen for. A claimed path with no route
 * behind it is worse than an unclaimed one: iOS hands the URL to the app and
 * the person lands on a blank screen instead of the web page that works.
 *
 * - `/gigs/*`   → `app/gigs/[id].tsx`
 * - `/tickets/*` → `app/tickets/[orderId].tsx`, which reads the path segment as
 *   an order access token — the same token the emailed link carries.
 *
 * Excluded, deliberately: `/tickets/terms` and `/tickets/<token>/details` are
 * web-only pages, and `/t/*` is a single-ticket view the app does not have.
 */
const PATHS = [
  "NOT /tickets/terms",
  "NOT /tickets/*/details",
  "/gigs/*",
  "/tickets/*",
];

export const dynamic = "force-static";

export function GET(): Response {
  const body = {
    applinks: {
      details: [{ appIDs: [APP_ID], appID: APP_ID, paths: PATHS }],
    },
    // Lets iOS share saved Atmos passwords between Safari and the app, so
    // signing in on the handset is an autofill rather than a typing exercise.
    webcredentials: { apps: [APP_ID] },
  };

  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
      // Apple's CDN caches this; a day is long enough to be cheap and short
      // enough that a path change is not stuck for a week.
      "cache-control": "public, max-age=86400",
    },
  });
}
