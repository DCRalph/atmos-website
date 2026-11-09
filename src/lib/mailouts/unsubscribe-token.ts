import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The token in every unsubscribe link: who it is for, and which mailout it
 * came in, signed so it cannot be edited into somebody else's.
 *
 * Nothing is stored, so links never expire, which the Unsolicited Electronic
 * Messages Act wants of an unsubscribe for at least 30 days after a send.
 * The key comes from the server (see `~/server/mailouts/links`); taking it as
 * an argument keeps this testable.
 *
 * Shape: `<subscriberId>.<mailoutId or ->.<signature>`. Cuids have no dots.
 */

const NO_MAILOUT = "-";

function signature(key: string, payload: string) {
  // 128 bits is plenty for a link nobody can brute force online.
  return createHmac("sha256", key)
    .update(payload)
    .digest("base64url")
    .slice(0, 22);
}

export function signUnsubscribeToken(
  key: string,
  subscriberId: string,
  mailoutId: string | null,
): string {
  const payload = `${subscriberId}.${mailoutId ?? NO_MAILOUT}`;
  return `${payload}.${signature(key, payload)}`;
}

export function verifyUnsubscribeToken(
  key: string,
  token: string,
): { subscriberId: string; mailoutId: string | null } | null {
  const [subscriberId, mailoutId, given, ...rest] = token.split(".");
  if (!subscriberId || !mailoutId || !given || rest.length) return null;
  const expected = signature(key, `${subscriberId}.${mailoutId}`);
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return {
    subscriberId,
    mailoutId: mailoutId === NO_MAILOUT ? null : mailoutId,
  };
}
