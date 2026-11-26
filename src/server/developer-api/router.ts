import "server-only";

import { randomUUID } from "node:crypto";

import { TRPCError } from "@trpc/server";
import { z, ZodError } from "zod";

import { hasScope, type ApiScope } from "~/lib/developer/scopes";
import { authenticate, type ApiCaller } from "~/server/api-keys";
import { adminCallerFor, type AdminCaller } from "./caller";
import { ApiError, callContext, requiredScopes } from "./endpoint";
import { matchEndpoint } from "./registry";
import { runAsApiRequest } from "./request-context";

/**
 * Serving the developer API: find the endpoint, check the key and its scopes,
 * validate what was sent, run it, and send back only what the endpoint's
 * response schema describes.
 *
 * Every answer is JSON. Errors are `{ "error": { "code", "message" } }`, with
 * anything more inside `error`. Every answer carries `X-Request-Id`, and the
 * key's remaining requests this minute when it has a limit.
 */

export async function handleApiRequest(
  request: Request,
  path: string,
): Promise<Response> {
  const requestId = randomUUID();
  const headers = new Headers({
    "X-Request-Id": requestId,
    "Cache-Control": "no-store",
  });
  const reply = (status: number, body: unknown) =>
    Response.json(body, { status, headers });
  const fail = (
    status: number,
    code: string,
    message: string,
    extra?: Record<string, unknown>,
  ) => reply(status, { error: { code, message, ...extra } });

  const match = matchEndpoint(request.method, path);
  if (match.kind === "none") {
    return fail(
      404,
      "not_found",
      `No endpoint at ${path}. GET /api/v1/openapi.json lists them all.`,
    );
  }
  if (match.kind === "wrong_method") {
    headers.set("Allow", match.allow.join(", "));
    return fail(
      405,
      "method_not_allowed",
      `${path} takes ${match.allow.join(", ")}.`,
    );
  }
  const { endpoint } = match;

  const authed = await authenticate(request);
  if (!authed.ok) {
    if (authed.failure.retryAfter) {
      headers.set("Retry-After", String(authed.failure.retryAfter));
    }
    return fail(
      authed.failure.status,
      authed.failure.code,
      authed.failure.message,
    );
  }
  const key = authed.caller;
  if (key.remaining !== null) {
    headers.set("X-RateLimit-Remaining", String(key.remaining));
  }

  // A fixed scope is checked before the request is, so a key that cannot use
  // an endpoint learns nothing about what it takes.
  const lacking = (scopes: readonly ApiScope[]) =>
    scopes.filter((scope) => !hasScope(key.permissions, scope));
  // One that depends on the body still needs at least one of its scopes.
  const upfront = endpoint.scope;
  if (typeof upfront === "string") {
    const missing = lacking([upfront]);
    if (missing.length > 0) {
      return fail(403, "missing_scope", missingMessage(missing), { missing });
    }
  } else if (
    upfront !== null &&
    lacking(upfront.mayNeed).length === upfront.mayNeed.length
  ) {
    return fail(
      403,
      "missing_scope",
      `This key has none of the scopes this endpoint needs: ${upfront.mayNeed.join(", ")}.`,
      { missing: upfront.mayNeed },
    );
  }

  const params = (endpoint.params ?? z.object({})).safeParse(match.params);
  if (!params.success) {
    return invalid(fail, "invalid_request", params.error);
  }
  const query = (endpoint.query ?? z.object({})).safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success) {
    return invalid(fail, "invalid_request", query.error);
  }

  let body: unknown = undefined;
  if (endpoint.body) {
    let raw: unknown = {};
    const text = await request.text();
    if (text.trim()) {
      try {
        raw = JSON.parse(text);
      } catch {
        return fail(400, "invalid_body", "The body must be JSON.");
      }
    }
    const parsed = endpoint.body.safeParse(raw);
    if (!parsed.success) return invalid(fail, "invalid_body", parsed.error);
    body = parsed.data;
  }

  const missing = lacking(requiredScopes(endpoint.scope, body));
  if (missing.length > 0) {
    return fail(403, "missing_scope", missingMessage(missing), { missing });
  }

  let admin: Promise<AdminCaller> | null = null;
  const ctx = callContext(
    key,
    () => (admin ??= adminCallerFor(key, request.headers)),
  );

  try {
    const result = await runAsApiRequest(
      { keyId: key.keyId, keyName: key.name },
      () => endpoint.run({ params: params.data, query: query.data, body }, ctx),
    );
    const shaped = endpoint.response.safeParse(result);
    if (!shaped.success) {
      // Our mistake, not the caller's: the handler gave back something its
      // own schema does not describe.
      console.error("[developer-api] response failed its schema", {
        requestId,
        path: endpoint.path,
        issues: shaped.error.issues,
      });
      return fail(
        500,
        "internal_error",
        `Something went wrong. Request ${requestId}.`,
      );
    }
    return reply(endpoint.status ?? 200, shaped.data);
  } catch (error) {
    return failureFor(error, fail, requestId, key);
  }
}

function missingMessage(missing: ApiScope[]): string {
  return missing.length === 1
    ? `This key does not have the ${missing[0]} scope.`
    : `This key does not have the ${missing.join(" and ")} scopes.`;
}

type Fail = (
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
) => Response;

function invalid(fail: Fail, code: string, error: ZodError): Response {
  return fail(400, code, z.prettifyError(error), {
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

/** tRPC's codes, as this API's statuses. Anything else is a 500. */
const TRPC_STATUS: Partial<
  Record<TRPCError["code"], { status: number; code: string }>
> = {
  BAD_REQUEST: { status: 400, code: "bad_request" },
  UNPROCESSABLE_CONTENT: { status: 400, code: "bad_request" },
  FORBIDDEN: { status: 403, code: "forbidden" },
  NOT_FOUND: { status: 404, code: "not_found" },
  CONFLICT: { status: 409, code: "conflict" },
  PRECONDITION_FAILED: { status: 409, code: "conflict" },
  TOO_MANY_REQUESTS: { status: 429, code: "rate_limited" },
};

function failureFor(
  error: unknown,
  fail: Fail,
  requestId: string,
  key: ApiCaller,
): Response {
  if (error instanceof ApiError) {
    return fail(error.status, error.code, error.message, error.extra);
  }
  if (error instanceof TRPCError) {
    // An admin procedure's own input check: the API's schema let through
    // something the admin's is stricter about.
    if (error.cause instanceof ZodError) {
      return invalid(fail, "invalid_body", error.cause);
    }
    const mapped = TRPC_STATUS[error.code];
    // Deliberate errors carry a message written for people. One wrapping an
    // unexpected failure carries that failure as its cause, and its message
    // could be a database error, so it is not passed on.
    if (mapped && !error.cause) {
      return fail(mapped.status, mapped.code, error.message);
    }
    if (!error.cause && error.code === "INTERNAL_SERVER_ERROR") {
      return fail(500, "internal_error", error.message);
    }
  }
  console.error("[developer-api] request failed", {
    requestId,
    keyId: key.keyId,
    error,
  });
  return fail(
    500,
    "internal_error",
    `Something went wrong. Request ${requestId}.`,
  );
}
