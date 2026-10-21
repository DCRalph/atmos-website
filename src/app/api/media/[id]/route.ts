import { NextResponse, type NextRequest } from "next/server";
import { db } from "~/server/db";
import { buildPublicUrl, presignGet } from "~/server/uploads/r2";
import { FileUploadStatus } from "~Prisma/client";
import { auth } from "~/server/auth";
import { userHasPermission } from "~/server/utils/permissions";

const ONE_DAY_SECONDS = 60 * 60 * 24;

/**
 * Stable address for an uploaded file. Public media redirects to R2 and the
 * redirect is cached by the CDN. Conversation attachments check admin access
 * and use an uncached presigned redirect instead. Bytes do not pass through Vercel.
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
    select: { key: true, name: true, preset: true },
  });
  if (!record) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // Conversation documents are admin material; their stable URLs must not be cached publicly.
  if (record.preset === "willGptAttachment") {
    const session = await auth.api.getSession({ headers: request.headers });
    const user = session?.user
      ? await db.user.findUnique({
          where: { id: session.user.id },
          include: { permissions: true },
        })
      : null;
    if (!user || !userHasPermission(user, "ADMIN")) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    return NextResponse.redirect(
      await presignGet({
        key: record.key,
        contentDisposition: `${request.nextUrl.searchParams.has("download") ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(record.name)}`,
      }),
      { status: 307, headers: { "Cache-Control": "private, no-store" } },
    );
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
