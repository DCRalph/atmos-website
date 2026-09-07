import { randomUUID } from "node:crypto";
import { headers } from "next/headers";

import { ActivityType } from "~Prisma/client";
import {
  isJsonObject,
  createStandalonePassDraft,
  walletPassDebugRequestSchema,
  type JsonObject,
} from "~/lib/ticketing/wallet-pass-debug";
import { env } from "~/env";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { sendWalletDebugEmail } from "~/server/ticketing/email/wallet-debug";
import { logActivity } from "~/server/utils/activity-log";
import { userHasPermission } from "~/server/utils/permissions";
import {
  appleCertDaysRemaining,
  isAppleWalletConfigured,
} from "~/server/wallet/apple-config";
import {
  buildStandaloneApplePass,
  standalonePassFilename,
} from "~/server/wallet/apple-debug";

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

function passName(manifest: JsonObject): string {
  const ticket = manifest.eventTicket;
  if (!isJsonObject(ticket)) return "Apple Wallet test pass";
  const primary = ticket.primaryFields;
  if (!Array.isArray(primary)) return "Apple Wallet test pass";
  const first = primary[0];
  if (!isJsonObject(first)) return "Apple Wallet test pass";
  const value = first.value;
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "Apple Wallet test pass";
}

function errorResponse(message: string, status: number): Response {
  return Response.json(
    { error: message },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export async function GET(): Promise<Response> {
  if (!(await adminUser())) return errorResponse("Unauthorized", 401);

  return Response.json(
    {
      configured: isAppleWalletConfigured(),
      certificateDaysRemaining: appleCertDaysRemaining(),
      draft: createStandalonePassDraft({
        passTypeIdentifier: env.APPLE_PASS_TYPE_ID ?? "",
        teamIdentifier: env.APPLE_TEAM_ID ?? "",
        serialNumber: `atmos.debug.${randomUUID()}`,
      }),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request): Promise<Response> {
  const user = await adminUser();
  if (!user) return errorResponse("Unauthorized", 401);
  if (!isAppleWalletConfigured()) {
    return errorResponse("Apple Wallet signing is not configured.", 503);
  }
  const certificateDays = appleCertDaysRemaining();
  if (certificateDays !== null && certificateDays < 0) {
    return errorResponse("The Apple Wallet certificate has expired.", 503);
  }

  try {
    const body: unknown = await request.json();
    const input = walletPassDebugRequestSchema.parse(body);
    const buffer = await buildStandaloneApplePass(input.draft);
    const filename = standalonePassFilename(input.draft.manifest);

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
      passName: passName(input.draft.manifest),
    });
    if (!result.ok) {
      return errorResponse(result.error ?? "The email could not be sent.", 502);
    }

    await logActivity({
      type: ActivityType.OTHER,
      action: `Sent a standalone Apple Wallet debug pass to ${recipient}`,
      userId: user.id,
      details: {
        recipient,
        serialNumber: input.draft.manifest.serialNumber ?? null,
        provider: result.provider,
        messageId: result.messageId ?? null,
      },
    });

    return Response.json(
      { ok: true, provider: result.provider },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Invalid pass";
    return errorResponse(message, 422);
  }
}
