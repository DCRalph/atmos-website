import "server-only";

import { createHmac } from "node:crypto";

import { env } from "~/env";
import { SITE_URL } from "~/lib/seo-constants";
import {
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from "~/lib/mailouts/unsubscribe-token";

/**
 * Unsubscribe links. The key is derived from the auth secret, so there is no
 * new secret to set, and rotating that secret is the one way to kill every
 * link at once.
 */
function key() {
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update("mailout-unsubscribe")
    .digest("base64url");
}

export const unsubscribeToken = (
  subscriberId: string,
  mailoutId: string | null,
) => signUnsubscribeToken(key(), subscriberId, mailoutId);

export const readUnsubscribeToken = (token: string) =>
  verifyUnsubscribeToken(key(), token);

/** The preferences page, linked from every footer. */
export const preferencesUrl = (token: string) =>
  `${SITE_URL}/unsubscribe/${token}`;

/**
 * Where a mail app's own Unsubscribe button posts (RFC 8058), as the two
 * headers that make Gmail and Apple Mail draw one.
 */
export const unsubscribeHeaders = (token: string) => ({
  "List-Unsubscribe": `<${SITE_URL}/api/unsubscribe/${token}>`,
  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
});
