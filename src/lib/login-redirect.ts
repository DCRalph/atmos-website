/** Request header the proxy sets to the path being requested, for login redirects. */
export const PATHNAME_HEADER = "x-pathname";

/**
 * The `next` query param from /login, if it is a same-site path. Anything else
 * (absolute URLs, `//host`, `/\host`) is dropped so the login page can't be
 * used as an open redirect.
 */
export function safeNextPath(next: string | string[] | undefined) {
  if (typeof next !== "string") return null;
  if (
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/\\")
  ) {
    return null;
  }
  return next;
}

/** /login, remembering where to send the user once they're signed in. */
export function loginHref(next: string | null) {
  const path = safeNextPath(next ?? undefined);
  return path && path !== "/"
    ? `/login?next=${encodeURIComponent(path)}`
    : "/login";
}
