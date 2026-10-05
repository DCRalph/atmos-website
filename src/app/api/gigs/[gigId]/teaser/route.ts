import { db } from "~/server/db";
import { renderTeaser } from "~/server/gig-teaser";
import { getObjectBuffer } from "~/server/uploads/r2";
import { FileUploadStatus, GigStatus } from "~Prisma/client";

/**
 * A published gig's poster, blurred beyond recognition. TBA gigs link here in
 * place of their poster — see `teaserPosterUrl`.
 *
 * Serving any gig's teaser is fine: a blur gives away nothing the poster does
 * not. The `v` query is only a cache key and is not read.
 */

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gigId: string }> },
): Promise<Response> {
  const { gigId } = await params;

  const gig = await db.gig.findFirst({
    where: { id: gigId, status: GigStatus.PUBLISHED },
    select: { posterFileUploadId: true },
  });
  const poster = gig?.posterFileUploadId
    ? await db.file_upload.findUnique({
        where: { id: gig.posterFileUploadId, status: FileUploadStatus.OK },
        select: { key: true },
      })
    : null;
  if (!poster) return new Response("Not found", { status: 404 });

  const teaser = await renderTeaser(await getObjectBuffer(poster.key));
  return new Response(new Uint8Array(teaser), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
    },
  });
}
