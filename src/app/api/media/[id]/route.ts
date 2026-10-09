import { NextResponse, type NextRequest } from "next/server";
import { db } from "~/server/db";
import { buildPublicUrl, presignGet } from "~/server/uploads/r2";
import { FileUploadStatus } from "~Prisma/client";

const ONE_DAY_SECONDS = 60 * 60 * 24;

/**
 * Stable address for an uploaded file. Redirects to the object on R2's public
 * domain rather than streaming it, so the bytes never pass through Vercel.
 * The redirect itself is cached by the CDN, so repeat hits never reach this
 * function either.
 *
 * `?download=1` redirects to a short-lived presigned URL that tells R2 to save
 * the original under its uploaded name instead of displaying it.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const record = await db.file_upload.findUnique({
    where: { id, status: FileUploadStatus.OK },
    select: { key: true, name: true },
  });
  if (!record) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  if (request.nextUrl.searchParams.has("download")) {
    const url = await presignGet({
      key: record.key,
      contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(record.name)}`,
    });
    return NextResponse.redirect(url, {
      status: 307,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  // Not `immutable`: a file's key can still change (or the file be deleted),
  // and a day-old redirect is cheap to refresh.
  return NextResponse.redirect(buildPublicUrl(record.key), {
    status: 307,
    headers: {
      "Cache-Control": `public, max-age=${ONE_DAY_SECONDS}, s-maxage=${ONE_DAY_SECONDS}, stale-while-revalidate=${ONE_DAY_SECONDS}`,
    },
  });
}
