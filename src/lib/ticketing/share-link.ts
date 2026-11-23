/**
 * Share links: `/share/[token]` opens one event's read-only organiser pages
 * with no account. The page's tRPC calls carry the token in this header, and
 * `eventViewerProcedure` scopes them to the link's event.
 */
export const SHARE_TOKEN_HEADER = "x-event-share-token";

/**
 * Takes the token out of any share link inside `value`. The token is the
 * credential, so analytics gets the address without it.
 */
export const redactShareToken = (value: string): string =>
  value.replace(/\/share\/[^/?#\s]+/g, "/share/redacted");

/** The token of the share page the browser is on, if it is on one. */
export const shareTokenFromPath = (pathname: string): string | null =>
  /^\/share\/([^/]+)/.exec(pathname)?.[1] ?? null;
