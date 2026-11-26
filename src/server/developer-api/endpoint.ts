import "server-only";

import type { z } from "zod";

import { hasScope, type ApiScope } from "~/lib/developer/scopes";
import type { ApiCaller } from "~/server/api-keys";
import type { AdminCaller } from "./caller";

/**
 * One endpoint of the developer API: where it lives, what it needs, what it
 * takes and gives, and what it does.
 *
 * Everything the outside world sees is a Zod schema here, so the same object
 * validates the request, strips the response down to what is documented, and
 * becomes the OpenAPI spec the reference page and the playground are drawn
 * from. Adding an endpoint is one `defineEndpoint` in `./endpoints`.
 */

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

/**
 * A failure with its own status and code, for a handler that has something
 * more specific to say than the admin procedure errors the router maps.
 * `extra` rides along inside `error`.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/**
 * The scope an endpoint needs. Most need one; a few depend on the request,
 * such as sending to `announcements` or cancelling an event. Those list every
 * scope they might ask for, for the reference, and `pick` says which this
 * request needs, all of them required. Null is any working key.
 */
export type EndpointScope<TBody> =
  | ApiScope
  | null
  | {
      mayNeed: readonly ApiScope[];
      pick: (body: TBody) => readonly ApiScope[];
    };

/** What a handler gets besides its parsed input. */
export type CallContext = {
  key: ApiCaller;
  /** Whether the key holds a scope, for the `sensitive` ones that widen a response. */
  has: (scope: ApiScope) => boolean;
  /** The admin's tRPC procedures, as the Developer API system user. */
  admin: () => Promise<AdminCaller>;
};

type AnyObject = z.ZodObject;

export type EndpointConfig<
  TParams extends AnyObject,
  TQuery extends AnyObject,
  TBody extends z.ZodType,
  TResponse extends z.ZodType,
> = {
  method: HttpMethod;
  /** OpenAPI style, relative to `/api/v1`: `/gigs/{id}`. */
  path: `/${string}`;
  /** The reference's section, such as "Gigs". */
  tag: string;
  summary: string;
  description?: string;
  scope: EndpointScope<z.output<TBody>>;
  /** Sensitive scopes that add fields to the response, for the reference. */
  widenedBy?: readonly ApiScope[];
  params?: TParams;
  query?: TQuery;
  body?: TBody;
  /** A body to start from, for the reference and the playground. */
  example?: z.input<TBody>;
  response: TResponse;
  /** 200 unless it creates something. */
  status?: 200 | 201;
  run: (
    input: {
      params: z.output<TParams>;
      query: z.output<TQuery>;
      body: z.output<TBody>;
    },
    ctx: CallContext,
  ) => Promise<z.input<TResponse>>;
};

/** An endpoint with its types erased, as the router and the spec handle it. */
export type Endpoint = EndpointConfig<
  AnyObject,
  AnyObject,
  z.ZodType,
  z.ZodType
>;

/** What a missing `params` or `query` parses to. */
type Empty = z.ZodObject<Record<string, never>>;

/**
 * Declare an endpoint. Inference flows from the schemas into `run`, so a
 * handler's input and return are checked against what is documented.
 */
export function defineEndpoint<
  TParams extends AnyObject = Empty,
  TQuery extends AnyObject = Empty,
  TBody extends z.ZodType = z.ZodUndefined,
  TResponse extends z.ZodType = z.ZodType,
>(config: EndpointConfig<TParams, TQuery, TBody, TResponse>): Endpoint {
  // Variance: `run` takes the narrowed input. The router only ever calls it
  // with the output of these same schemas.
  return config as unknown as Endpoint;
}

/** Every scope an endpoint might need, for the reference. */
export function scopesOf(scope: Endpoint["scope"]): readonly ApiScope[] {
  if (scope === null) return [];
  return typeof scope === "string" ? [scope] : scope.mayNeed;
}

/** The scopes this request needs, once its body is known. */
export function requiredScopes(
  scope: Endpoint["scope"],
  body: unknown,
): readonly ApiScope[] {
  if (scope === null) return [];
  if (typeof scope === "string") return [scope];
  return scope.pick(body);
}

export function callContext(
  key: ApiCaller,
  admin: () => Promise<AdminCaller>,
): CallContext {
  return {
    key,
    has: (scope) => hasScope(key.permissions, scope),
    admin,
  };
}
