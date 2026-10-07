import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";

import { env } from "~/env";
import { appRouter } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a HTTP request (e.g. when you make requests from Client Components).
 */
/**
 * Two procedures here are slow by nature: reading an Instagram post into a gig
 * (a model call with the poster attached, on top of downloading the image) and
 * a Will GPT run (several model turns in a row, which budgets itself to fit).
 * The platform default cuts both off well before they finish, and every other
 * procedure is unaffected by a longer ceiling because they return in
 * milliseconds either way.
 */
export const maxDuration = 300;

const createContext = async (opts: { req: Request; resHeaders: Headers }) => {
  return createTRPCContext({
    headers: opts.req.headers,
    resHeaders: opts.resHeaders,
  });
};

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
    onError:
      env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(
              `❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`,
            );
          }
        : undefined,
  });

export { handler as GET, handler as POST };
