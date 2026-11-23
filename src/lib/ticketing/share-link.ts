/**
 * Share links: `/share/[token]` opens one event's read-only organiser pages
 * with no account. The page's tRPC calls carry the token in this header, and
 * `eventViewerProcedure` scopes them to the link's event.
 */
export const SHARE_TOKEN_HEADER = "x-event-share-token";

/** The token of the share page the browser is on, if it is on one. */
export const shareTokenFromPath = (pathname: string): string | null =>
  /^\/share\/([^/]+)/.exec(pathname)?.[1] ?? null;
