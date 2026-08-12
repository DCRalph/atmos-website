import { createTRPCReact } from "@trpc/react-query";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "~/server/api/root";

/**
 * The website's tRPC API, typed.
 *
 * `AppRouter` is imported as a type only, so none of the server code — Prisma,
 * the database client, the ticketing internals — is reachable from the bundle.
 * TypeScript erases the import; Metro never sees it.
 */
export const api = createTRPCReact<AppRouter>();

export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
