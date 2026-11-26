import { openApiSpec } from "~/server/developer-api/openapi";

/**
 * The developer API's OpenAPI 3.1 spec. Public: it describes the API, and
 * every endpoint in it still needs a key.
 */

export const runtime = "nodejs";

export function GET(): Response {
  return Response.json(openApiSpec(), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
