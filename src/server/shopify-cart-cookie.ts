import { env } from "~/env";

export const SHOPIFY_CART_COOKIE = "shopify_cart_id";

const MAX_AGE_SEC = 60 * 60 * 24 * 14;

export function parseCartIdFromCookieString(raw: string | null): string | null {
  if (!raw) return null;
  const parts = raw.split(";").map((c) => c.trim());
  for (const p of parts) {
    if (p.startsWith(`${SHOPIFY_CART_COOKIE}=`)) {
      try {
        return decodeURIComponent(p.slice(SHOPIFY_CART_COOKIE.length + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function parseCartIdFromHeaders(headers: Headers): string | null {
  return parseCartIdFromCookieString(headers.get("cookie"));
}

export function setCartCookie(resHeaders: Headers | undefined, cartId: string) {
  if (!resHeaders) return;
  const secure = env.NODE_ENV === "production" ? "; Secure" : "";
  resHeaders.append(
    "Set-Cookie",
    `${SHOPIFY_CART_COOKIE}=${encodeURIComponent(cartId)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${MAX_AGE_SEC}`,
  );
}

export function clearCartCookie(resHeaders: Headers | undefined) {
  if (!resHeaders) return;
  const secure = env.NODE_ENV === "production" ? "; Secure" : "";
  resHeaders.append(
    "Set-Cookie",
    `${SHOPIFY_CART_COOKIE}=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`,
  );
}
