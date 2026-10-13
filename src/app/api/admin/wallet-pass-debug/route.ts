import { headers } from "next/headers";

import { ActivityType } from "~Prisma/client";
import {
  walletPassDebugRequestSchema,
  type WalletPassDebugDefaultsResponse,
} from "~/lib/ticketing/wallet-pass-debug";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { sendWalletDebugEmail } from "~/server/ticketing/email/wallet-debug";
import { logActivity } from "~/server/utils/activity-log";
import { userHasPermission } from "~/server/utils/permissions";
import {
  appleCertDaysRemaining,
  isAppleWalletConfigured,
} from "~/server/wallet/apple-config";
import { buildDebugPass, composeDebugPass } from "~/server/wallet/apple-debug";

/**
 * The wallet debugger's server side: what it can start from, a composition
 * of the current draft for the preview, and the signed pass itself.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function adminUser(): Promise<{ id: string } | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { permissions: true },
  });
  return user && userHasPermission(user, "ADMIN") ? user : null;
}

function errorResponse(message: string, status: number): Response {
  return Response.json(
    { error: message },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export async function GET(): Promise<Response> {
  if (!(await adminUser())) return errorResponse("Unauthorized", 401);

  const [events, levels] = await Promise.all([
    db.ticketEvent.findMany({
      orderBy: { startsAt: "desc" },
      take: 60,
      select: { id: true, name: true, startsAt: true, status: true },
    }),
    db.accessLevel.findMany({
      where: { archived: false },
      orderBy: [{ rank: "asc" }, { code: "asc" }],
      select: { code: true, label: true, short: true },
    }),
  ]);

  const body: WalletPassDebugDefaultsResponse = {
    configured: isAppleWalletConfigured(),
    certificateDaysRemaining: appleCertDaysRemaining(),
    events: events.map((event) => ({
      id: event.id,
      name: event.name,
      startsAt: event.startsAt.toISOString(),
      status: event.status,
    })),
    levels,
  };
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  const user = await adminUser();
  if (!user) return errorResponse("Unauthorized", 401);

  let input;
  try {
    input = walletPassDebugRequestSchema.parse(await request.json());
  } catch (cause) {
    return errorResponse(
      cause instanceof Error ? cause.message : "Invalid request",
      400,
    );
  }

  try {
    if (input.action === "compose") {
      const { response } = await composeDebugPass(input.draft);
      return Response.json(response, {
        headers: { "cache-control": "no-store" },
      });
    }

    if (!isAppleWalletConfigured()) {
      return errorResponse("Apple Wallet signing is not configured.", 503);
    }
    const certificateDays = appleCertDaysRemaining();
    if (certificateDays !== null && certificateDays < 0) {
      return errorResponse("The Apple Wallet certificate has expired.", 503);
    }

    const { buffer, filename, passName } = await buildDebugPass(input.draft);

    if (input.action === "download") {
      return new Response(new Uint8Array(buffer), {
        headers: {
          "content-type": "application/vnd.apple.pkpass",
          "content-disposition": `attachment; filename="${filename}"`,
          "cache-control": "no-store",
        },
      });
    }

    const recipient = input.recipient;
    if (!recipient) return errorResponse("Enter an email recipient.", 400);
    const result = await sendWalletDebugEmail({
      to: recipient,
      pass: buffer,
      filename,
      passName,
    });
    if (!result.ok) {
      return errorResponse(result.error ?? "The email could not be sent.", 502);
    }

    await logActivity({
      type: ActivityType.OTHER,
      action: `Sent an Apple Wallet debug pass to ${recipient}`,
      userId: user.id,
      details: {
        recipient,
        source: input.draft.source,
        serialNumber: input.draft.patch.serialNumber ?? null,
        messageId: result.messageId ?? null,
      },
    });

    return Response.json(
      { ok: true },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Invalid pass";
    return errorResponse(message, 422);
  }
}
