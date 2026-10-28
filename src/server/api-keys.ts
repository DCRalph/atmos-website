import "server-only";

import { timingSafeEqual } from "node:crypto";

import { env } from "~/env";
import {
  hasScope,
  scopesToPermissions,
  type ApiKeyPermissions,
  type ApiScope,
} from "~/lib/developer/scopes";
import { presentedCredential } from "~/lib/notify/request-auth";
import { auth } from "~/server/auth";

/**
 * Authenticating the developer API and the ntfy endpoint.
 *
 * Two steps, because what a send needs depends on its body: `authenticate`
 * says who is calling before the body is read, so a bad key is a 401 whatever
 * it sent, and `authorize` checks a scope once the route knows which one.
 *
 * Keys are better-auth's api-key plugin. Scopes are checked here rather than
 * by passing `permissions` to `verifyApiKey`, because the plugin answers a
 * missing scope with the same "key not found" as a wrong key, and somebody
 * wiring up an integration deserves to hear which it was.
 */

/** Who is calling. `keyId` is null for the legacy `NOTIFY_TOKEN`. */
export type ApiCaller = {
  keyId: string | null;
  name: string;
  permissions: ApiKeyPermissions;
};

export type ApiAuthFailure = {
  status: 401 | 403 | 429;
  code: "unauthorized" | "missing_scope" | "rate_limited";
  message: string;
  /** Seconds, for `Retry-After`. */
  retryAfter?: number;
};

/**
 * `NOTIFY_TOKEN` predates API keys and could publish to any topic, so it keeps
 * exactly that and nothing new. Accepted by the ntfy endpoint only.
 */
const LEGACY_CALLER: ApiCaller = {
  keyId: null,
  name: "NOTIFY_TOKEN",
  permissions: scopesToPermissions([
    "notifications:topic",
    "notifications:announce",
  ]),
};

export async function authenticate(
  request: Request,
  { allowLegacyToken = false }: { allowLegacyToken?: boolean } = {},
): Promise<
  { ok: true; caller: ApiCaller } | { ok: false; failure: ApiAuthFailure }
> {
  const credential = presentedCredential(
    request.headers,
    new URL(request.url).searchParams,
  );
  if (!credential) {
    return unauthorized("Send an API key as a bearer token.");
  }

  const legacy = env.NOTIFY_TOKEN;
  if (allowLegacyToken && legacy && secretsMatch(credential, legacy)) {
    return { ok: true, caller: LEGACY_CALLER };
  }

  const result = await auth.api.verifyApiKey({ body: { key: credential } });
  if (!result.valid || !result.key) {
    const error = result.error;
    if (error?.code === "RATE_LIMITED") {
      return {
        ok: false,
        failure: {
          status: 429,
          code: "rate_limited",
          message: "Too many requests for this key.",
          retryAfter: Math.max(1, Math.ceil(tryAgainInMs(error) / 1000)),
        },
      };
    }
    // Ours rather than the plugin's: its `message` is a string on some paths
    // and an object on others.
    return unauthorized(
      error?.code === "KEY_DISABLED"
        ? "This API key is disabled."
        : error?.code === "KEY_EXPIRED"
          ? "This API key has expired."
          : "Invalid API key.",
    );
  }

  return {
    ok: true,
    caller: {
      keyId: result.key.id,
      name: result.key.name ?? "Unnamed key",
      permissions: result.key.permissions ?? {},
    },
  };
}

/** Null when the caller holds `scope`. */
export function authorize(
  caller: ApiCaller,
  scope: ApiScope,
): ApiAuthFailure | null {
  if (hasScope(caller.permissions, scope)) return null;
  return {
    status: 403,
    code: "missing_scope",
    message: `This key does not have the ${scope} scope.`,
  };
}

/** The plugin puts the wait in `details`, which its types do not declare. */
function tryAgainInMs(error: object): number {
  const details = "details" in error ? error.details : null;
  if (
    typeof details === "object" &&
    details !== null &&
    "tryAgainIn" in details &&
    typeof details.tryAgainIn === "number"
  ) {
    return details.tryAgainIn;
  }
  return 60_000;
}

function unauthorized(message: string): {
  ok: false;
  failure: ApiAuthFailure;
} {
  return { ok: false, failure: { status: 401, code: "unauthorized", message } };
}

/**
 * Constant-time comparison. The length check leaks the secret's length, which
 * is the same thing `timingSafeEqual` throwing on a length mismatch would.
 */
function secretsMatch(presented: string, expected: string): boolean {
  const a = Buffer.from(presented, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The developer API's error shape:
 * `{ "error": { "code": "missing_scope", "message": "…" } }`. `extra` rides
 * along inside `error`, for things like the ids a send could not resolve.
 */
export function apiError(
  failure: Pick<ApiAuthFailure, "message" | "retryAfter"> & {
    status: number;
    code: string;
  },
  extra?: Record<string, unknown>,
): Response {
  return Response.json(
    { error: { code: failure.code, message: failure.message, ...extra } },
    {
      status: failure.status,
      headers: failure.retryAfter
        ? { "Retry-After": String(failure.retryAfter) }
        : undefined,
    },
  );
}
