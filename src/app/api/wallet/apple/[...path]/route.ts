import type { NextRequest } from "next/server";

import { TicketStatus } from "~Prisma/client";
import { db } from "~/server/db";
import {
  buildApplePass,
  verifyApplePassAuthToken,
} from "~/server/wallet/apple";
import { isAppleWalletConfigured } from "~/server/wallet/apple-config";

/**
 * Apple Wallet web service.
 *
 * Implements the endpoints Apple calls to keep a pass current:
 *
 *   POST   /v1/devices/{device}/registrations/{passType}/{serial}
 *   DELETE /v1/devices/{device}/registrations/{passType}/{serial}
 *   GET    /v1/devices/{device}/registrations/{passType}?passesUpdatedSince=
 *   GET    /v1/passes/{passType}/{serial}
 *   POST   /v1/log
 *
 * Without this, a pass is frozen at the moment it was added — no way to push a
 * changed door time or mark a cancelled event on a ticket already sitting in
 * somebody's wallet.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `Authorization: ApplePass <token>` */
function passToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("ApplePass ")) return null;
  return header.slice("ApplePass ".length).trim();
}

async function authorise(
  request: NextRequest,
  serialNumber: string,
): Promise<boolean> {
  const token = passToken(request);
  if (!token) return false;
  return verifyApplePassAuthToken(serialNumber, token);
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await ctx.params;

  // POST /v1/log — Apple posts diagnostics here when a pass misbehaves.
  if (path[0] === "v1" && path[1] === "log") {
    const body = (await request.json().catch(() => null)) as {
      logs?: string[];
    } | null;
    if (body?.logs?.length) {
      console.warn("[wallet:apple]", body.logs.join(" | "));
    }
    return new Response(null, { status: 200 });
  }

  // POST /v1/devices/{device}/registrations/{passType}/{serial}
  if (
    path[0] === "v1" &&
    path[1] === "devices" &&
    path[3] === "registrations"
  ) {
    const [, , deviceLibraryIdentifier, , passTypeIdentifier, serialNumber] =
      path;
    if (!deviceLibraryIdentifier || !passTypeIdentifier || !serialNumber) {
      return new Response(null, { status: 400 });
    }
    if (!(await authorise(request, serialNumber))) {
      return new Response(null, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      pushToken?: string;
    } | null;
    if (!body?.pushToken) return new Response(null, { status: 400 });

    const existing = await db.walletPassRegistration.findUnique({
      where: {
        deviceLibraryIdentifier_serialNumber: {
          deviceLibraryIdentifier,
          serialNumber,
        },
      },
      select: { id: true },
    });

    await db.walletPassRegistration.upsert({
      where: {
        deviceLibraryIdentifier_serialNumber: {
          deviceLibraryIdentifier,
          serialNumber,
        },
      },
      update: { pushToken: body.pushToken, passTypeIdentifier },
      create: {
        deviceLibraryIdentifier,
        passTypeIdentifier,
        serialNumber,
        pushToken: body.pushToken,
      },
    });

    // Apple distinguishes a new registration (201) from a repeat (200).
    return new Response(null, { status: existing ? 200 : 201 });
  }

  return new Response(null, { status: 404 });
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await ctx.params;

  if (
    path[0] === "v1" &&
    path[1] === "devices" &&
    path[3] === "registrations"
  ) {
    const [, , deviceLibraryIdentifier, , , serialNumber] = path;
    if (!deviceLibraryIdentifier || !serialNumber) {
      return new Response(null, { status: 400 });
    }
    if (!(await authorise(request, serialNumber))) {
      return new Response(null, { status: 401 });
    }

    await db.walletPassRegistration
      .delete({
        where: {
          deviceLibraryIdentifier_serialNumber: {
            deviceLibraryIdentifier,
            serialNumber,
          },
        },
      })
      .catch(() => undefined);

    return new Response(null, { status: 200 });
  }

  return new Response(null, { status: 404 });
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  if (!isAppleWalletConfigured()) {
    return new Response(null, { status: 404 });
  }

  const { path } = await ctx.params;

  // GET /v1/devices/{device}/registrations/{passType}?passesUpdatedSince=
  if (
    path[0] === "v1" &&
    path[1] === "devices" &&
    path[3] === "registrations"
  ) {
    const deviceLibraryIdentifier = path[2];
    if (!deviceLibraryIdentifier) return new Response(null, { status: 400 });

    const since = request.nextUrl.searchParams.get("passesUpdatedSince");
    const sinceDate = since ? new Date(Number(since) * 1000) : null;

    const registrations = await db.walletPassRegistration.findMany({
      where: { deviceLibraryIdentifier },
      select: { serialNumber: true },
    });
    if (registrations.length === 0) {
      return new Response(null, { status: 204 });
    }

    const serials = registrations.map((r) => r.serialNumber);
    const updated = await db.ticket.findMany({
      where: {
        id: { in: serials },
        ...(sinceDate ? { updatedAt: { gt: sinceDate } } : {}),
      },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    if (updated.length === 0) {
      return new Response(null, { status: 204 });
    }

    return Response.json({
      serialNumbers: updated.map((ticket) => ticket.id),
      lastUpdated: String(
        Math.floor((updated[0]?.updatedAt.getTime() ?? Date.now()) / 1000),
      ),
    });
  }

  // GET /v1/passes/{passType}/{serial}
  if (path[0] === "v1" && path[1] === "passes") {
    const serialNumber = path[3];
    if (!serialNumber) return new Response(null, { status: 400 });
    if (!(await authorise(request, serialNumber))) {
      return new Response(null, { status: 401 });
    }

    const ticket = await db.ticket.findUnique({
      where: { id: serialNumber },
      include: { tier: { select: { name: true } }, event: true, order: true },
    });
    if (ticket?.status !== TicketStatus.VALID) {
      return new Response(null, { status: 404 });
    }

    const buffer = await buildApplePass({
      ticket,
      event: ticket.event,
      orderNumber: ticket.order.orderNumber,
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Last-Modified": ticket.updatedAt.toUTCString(),
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(null, { status: 404 });
}
