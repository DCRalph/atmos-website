import { headers } from "next/headers";

import type { Prisma } from "~Prisma/client";
import {
  runSheetExportFilename,
  toRunSheetExport,
} from "~/lib/run-sheet/export";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { userHasPermission } from "~/server/utils/permissions";

/**
 * A gig's run sheet as a JSON file.
 *
 * An HTTP route rather than a tRPC procedure because the useful thing to do
 * with an export is save it: a link with `download` on it, or a `curl` from
 * whatever the venue runs. tRPC gives neither a filename nor a URL somebody can
 * paste into a script.
 *
 * Organisers only, and deliberately stricter than `runSheet.forGig` — that one
 * lets door staff read the night they are rostered on, with the internal notes
 * stripped out. A file is different from a screen: it gets forwarded, and it
 * carries the notes. So the answer here is the whole run sheet or nothing.
 *
 * The shape lives in `~/lib/run-sheet/export.ts`, which is what promises it
 * will not drift.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPORT_INCLUDE = {
  scheduleItems: {
    include: {
      artists: {
        orderBy: { sortOrder: "asc" },
        select: {
          creatorProfile: { select: { handle: true, displayName: true } },
        },
      },
    },
  },
} satisfies Prisma.GigInclude;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gigId: string }> },
): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { permissions: true },
  });
  if (!user) return new Response("Unauthorized", { status: 401 });

  if (
    !userHasPermission(user, "ADMIN") &&
    !userHasPermission(user, "EVENT_ORGANISER")
  ) {
    return new Response("Forbidden", { status: 403 });
  }

  const { gigId } = await params;
  const gig = await db.gig.findUnique({
    where: { id: gigId },
    include: EXPORT_INCLUDE,
  });
  if (!gig) return new Response("Not found", { status: 404 });

  const payload = toRunSheetExport(
    gig,
    gig.scheduleItems.map((item) => ({
      ...item,
      artists: item.artists.map((artist) => artist.creatorProfile),
    })),
  );

  // Indented because the point of an export is that a person opens it.
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${runSheetExportFilename(gig)}"`,
      "cache-control": "no-store",
    },
  });
}
