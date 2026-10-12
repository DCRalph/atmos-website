import { eventOgSource, gigOgSource, renderOgImage } from "~/server/og-image";

/**
 * A gig's or ticket event's link preview image. Pages point here through
 * `gigOgImage` and `eventOgImage`; see `~/server/og-image.ts`. The `v` query
 * is only a cache key and is not read.
 */

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string; id: string }> },
): Promise<Response> {
  const { kind, id } = await params;

  const source =
    kind === "gig"
      ? await gigOgSource(id)
      : kind === "event"
        ? await eventOgSource(id)
        : null;
  if (!source) return new Response("Not found", { status: 404 });

  const image = await renderOgImage(source);
  return new Response(new Uint8Array(image), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
    },
  });
}
