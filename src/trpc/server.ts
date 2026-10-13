import "server-only";

import { createHydrationHelpers } from "@trpc/react-query/rsc";
import { headers } from "next/headers";
import { cache } from "react";

import { createCaller, type AppRouter } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";
import { createQueryClient } from "./query-client";

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a tRPC call from a React Server Component.
 */
const createContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");

  return createTRPCContext({
    headers: heads,
  });
});

const getQueryClient = cache(createQueryClient);

/** This request's calls, by procedure path and input. */
const callsThisRequest = cache(() => new Map<string, Promise<unknown>>());

/**
 * The caller with every call memoized for the request. A page can `await
 * api.gigs.getById({ id })` for itself (to call `notFound()`, or for JSON-LD)
 * and `prefetch` the same query for the client, and the query runs once.
 */
function memoized<T>(target: T, path: readonly string[] = []): T {
  if (typeof target !== "function" && typeof target !== "object") {
    return target;
  }
  if (target === null) return target;

  return new Proxy(target, {
    get: (t, key) =>
      typeof key === "string"
        ? memoized(Reflect.get(t, key), [...path, key])
        : Reflect.get(t, key),
    apply: (t, thisArg, args: unknown[]) => {
      const id = `${path.join(".")}:${JSON.stringify(args[0] ?? null)}`;
      const calls = callsThisRequest();
      const call =
        calls.get(id) ??
        (Reflect.apply(
          t as () => Promise<unknown>,
          thisArg,
          args,
        ) as Promise<unknown>);
      calls.set(id, call);
      return call;
    },
  });
}

const caller = memoized(createCaller(createContext));

/**
 * Server Components fetch with `api`. To render a client component with its
 * data already in it, `await api.x.y.prefetch(input)` and wrap the component
 * in `<HydrateClient>`: its `useQuery` with the same input starts with the data
 * instead of a loading state, so the server HTML has the page's content.
 */
export const { trpc: api, HydrateClient } = createHydrationHelpers<AppRouter>(
  caller,
  getQueryClient,
);
