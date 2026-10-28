/**
 * The credential on a request, in any of the three forms ntfy accepts:
 *
 *   Authorization: Bearer <key>
 *   Authorization: Basic base64(<anything>:<key>)    the username is ignored
 *   ?auth=<base64url of the whole Authorization header>
 *
 * Shared by the ntfy endpoint and the v1 API, so a key works the same way
 * pasted into Uptime Kuma's ntfy settings as in a `curl -H`.
 */
export function presentedCredential(
  headers: Headers,
  searchParams: URLSearchParams,
): string | null {
  const header =
    headers.get("authorization") ?? decodeQueryAuth(searchParams.get("auth"));
  if (!header) return null;

  // "Bearer " with nothing after it is no credential, not an empty one.
  const credential = bearerToken(header) ?? basicPassword(header);
  if (!credential) return null;
  return credential;
}

function bearerToken(header: string): string | null {
  if (!/^Bearer /i.test(header)) return null;
  return header.slice("Bearer ".length).trim();
}

function basicPassword(header: string): string | null {
  if (!/^Basic /i.test(header)) return null;

  const decoded = decodeBase64(header.slice("Basic ".length).trim());
  if (decoded === null) return null;

  const separator = decoded.indexOf(":");
  return separator === -1 ? null : decoded.slice(separator + 1);
}

function decodeQueryAuth(param: string | null): string | null {
  if (!param) return null;
  return decodeBase64(param.replaceAll("-", "+").replaceAll("_", "/"));
}

function decodeBase64(value: string): string | null {
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    return decoded.length > 0 ? decoded : null;
  } catch {
    return null;
  }
}
