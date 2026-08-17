import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { getObjectStream } from "~/server/uploads/s3";
import { userHasPermission } from "~/server/utils/permissions";

/**
 * The portrait off somebody's ID.
 *
 * Its own route rather than `/api/media/[id]`, which is the path every other
 * image here takes. That one serves any completed upload to anybody and tells
 * them to cache it for a year — correct for a gig poster, indefensible for a
 * photograph of a member of the public. So this one re-checks door access on
 * every single request, streams the bytes from a private object, and forbids
 * caching anywhere: no CDN copy, no disk copy in a browser cache, nothing left
 * behind on a shared machine after a manager closes the tab.
 *
 * Access is "are you door staff at all" rather than "are you on this event".
 * A patron is not owned by an event — the whole point of the ban list is that
 * it spans them — so scoping the photo to one would answer the wrong question.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ patronId: string }> },
): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { permissions: true },
  });
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const isStaff =
    userHasPermission(user, "ADMIN") ||
    userHasPermission(user, "EVENT_ORGANISER") ||
    (await db.ticketEventStaff.count({ where: { userId: user.id } })) > 0;

  if (!isStaff) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { patronId } = await params;
  const patron = await db.patron.findUnique({
    where: { id: patronId },
    select: { photoKey: true },
  });

  if (!patron?.photoKey) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const { stream, contentType, contentLength } = await getObjectStream(
      patron.photoKey,
    );

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        stream.on("data", (chunk: Buffer) =>
          controller.enqueue(new Uint8Array(chunk)),
        );
        stream.on("end", () => controller.close());
        stream.on("error", (cause) => controller.error(cause));
      },
    });

    const responseHeaders = new Headers({
      "Content-Type": contentType,
      // The whole point of the route. A photo of somebody's face must not
      // outlive the request that asked for it.
      "Cache-Control": "private, no-store, max-age=0",
      // Nothing here should ever be framed, indexed, or hotlinked.
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    });
    if (contentLength !== undefined) {
      responseHeaders.set("Content-Length", String(contentLength));
    }

    return new NextResponse(body, { headers: responseHeaders });
  } catch (cause) {
    // A record whose object has already been swept is a 404, not a 500 — the
    // purge is allowed to have run between the page loading and the image
    // being fetched.
    console.error("[id-check] portrait fetch failed", cause);
    return new NextResponse("Not found", { status: 404 });
  }
}
