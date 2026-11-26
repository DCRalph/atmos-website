import { handleApiRequest } from "~/server/developer-api/router";

/**
 * The developer API: every `/api/v1/...` request, handed to the endpoint list
 * in `~/server/developer-api`. See `docs/DEVELOPER-API.md`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await params;
  return handleApiRequest(request, `/${path.join("/")}`);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
export const PUT = handle;
