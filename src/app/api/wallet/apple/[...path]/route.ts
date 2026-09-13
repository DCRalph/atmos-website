import type { NextRequest } from "next/server";

import { TicketStatus } from "~Prisma/client";
import { db } from "~/server/db";
import {
  buildApplePass,
  verifyApplePassAuthToken,
} from "~/server/wallet/apple";
import {
  buildLifetimePass,
  lifetimeIdFromSerial,
} from "~/server/wallet/apple-lifetime";
import { isAppleWalletConfigured } from "~/server/wallet/apple-config";
import { listUpdatedPasses, passUpdatedAt } from "~/server/wallet/pass-updates";

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
 *
 * Lifetime passes ride the same service under a namespaced serial (see
 * `lifetimeSerial`), so a revoked or re-levelled pass updates in the wallet
 * the same way a voided ticket does.
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
    const passTypeIdentifier = path[4];
    if (!deviceLibraryIdentifier || !passTypeIdentifier) {
      return new Response(null, { status: 400 });
    }

    const registrations = await db.walletPassRegistration.findMany({
      where: { deviceLibraryIdentifier, passTypeIdentifier },
      select: { serialNumber: true, passTypeIdentifier: true },
    });
    if (registrations.length === 0) {
      return new Response(null, { status: 204 });
    }

    const serials = registrations.map((r) => r.serialNumber);
    const lifetimeIds = serials
      .map(lifetimeIdFromSerial)
      .filter((id): id is string => id !== null);

    const [tickets, lifetimes] = await Promise.all([
      db.ticket.findMany({
        where: { id: { in: serials } },
        select: {
          id: true,
          updatedAt: true,
          event: { select: { updatedAt: true } },
        },
      }),
      lifetimeIds.length > 0
        ? db.lifetimeTicket.findMany({
            where: { id: { in: lifetimeIds } },
            select: { id: true, updatedAt: true },
          })
        : Promise.resolve([]),
    ]);

    // Freshness by serial, whichever table the serial names. A lifetime pass
    // has no event to be as fresh as, so its own timestamp stands in twice.
    const freshnessBySerial = new Map<
      string,
      { ticketUpdatedAt: Date; eventUpdatedAt: Date }
    >();
    for (const ticket of tickets) {
      freshnessBySerial.set(ticket.id, {
        ticketUpdatedAt: ticket.updatedAt,
        eventUpdatedAt: ticket.event.updatedAt,
      });
    }
    for (const lifetime of lifetimes) {
      freshnessBySerial.set(`lifetime.${lifetime.id}`, {
        ticketUpdatedAt: lifetime.updatedAt,
        eventUpdatedAt: lifetime.updatedAt,
      });
    }

    const listed = listUpdatedPasses({
      passTypeIdentifier,
      passesUpdatedSince:
        request.nextUrl.searchParams.get("passesUpdatedSince"),
      registrations: registrations.flatMap((registration) => {
        const freshness = freshnessBySerial.get(registration.serialNumber);
        if (!freshness) return [];
        return [
          {
            serialNumber: registration.serialNumber,
            passTypeIdentifier: registration.passTypeIdentifier,
            ...freshness,
          },
        ];
      }),
    });

    if (!listed) {
      return new Response(null, { status: 204 });
    }

    return Response.json(listed);
  }

  // GET /v1/passes/{passType}/{serial}
  if (path[0] === "v1" && path[1] === "passes") {
    const serialNumber = path[3];
    if (!serialNumber) return new Response(null, { status: 400 });
    if (!(await authorise(request, serialNumber))) {
      return new Response(null, { status: 401 });
    }

    // A revoked lifetime pass is still served, marked voided, so the wallet
    // greys it out rather than keeping a live-looking copy forever.
    const lifetimeId = lifetimeIdFromSerial(serialNumber);
    if (lifetimeId) {
      const lifetime = await db.lifetimeTicket.findUnique({
        where: { id: lifetimeId },
      });
      if (!lifetime) return new Response(null, { status: 404 });

      const buffer = await buildLifetimePass({ lifetime });
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.apple.pkpass",
          "Last-Modified": lifetime.updatedAt.toUTCString(),
          "Cache-Control": "no-store",
        },
      });
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

    const lastModified = passUpdatedAt(
      ticket.updatedAt,
      ticket.event.updatedAt,
    );

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Last-Modified": lastModified.toUTCString(),
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(null, { status: 404 });
}
