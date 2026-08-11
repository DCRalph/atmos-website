import "server-only";

import {
  TicketOrderStatus,
  TicketScanResult,
  TicketStatus,
} from "~Prisma/client";
import { db } from "~/server/db";
import { parseTicketToken, verifyTicketToken } from "~/server/ticketing/qr";

/**
 * The admit decision.
 *
 * Correctness here is worth more than speed: two door staff scanning the same
 * QR at the same instant must produce exactly one `ADMITTED`, or a shared
 * screenshot gets two people in. The whole decision therefore runs inside a
 * transaction that takes `FOR UPDATE` on the ticket row, so the second scanner
 * blocks for a few milliseconds and then correctly sees the first admission.
 *
 * Every scan is recorded, including the failures — a wall of `NOT_FOUND` at
 * 11pm is how you discover somebody is selling fake tickets outside.
 */

/** Results that mean the person is inside. */
const ADMITTING_RESULTS = [
  TicketScanResult.ADMITTED,
  TicketScanResult.OVERRIDE_ADMITTED,
  TicketScanResult.REENTRY,
] as const;

export type ScanOutcome = {
  result: TicketScanResult;
  /** Whether the person should be let in. */
  admit: boolean;
  message: string;
  ticket: {
    id: string;
    ticketNumber: string;
    tierName: string;
    attendeeName: string | null;
    buyerName: string | null;
    buyerEmail: string | null;
    orderNumber: string;
    /** e.g. "2 of 4" when a group bought together. */
    positionInOrder: string;
  } | null;
  previousAdmission: {
    at: Date;
    deviceLabel: string | null;
    scannedByName: string | null;
    admissionCount: number;
  } | null;
  isR18: boolean;
  /** Set when a DUPLICATE could be forced through by a manager. */
  canOverride: boolean;
};

function outcome(
  result: TicketScanResult,
  message: string,
  extras: Partial<ScanOutcome> = {},
): ScanOutcome {
  return {
    result,
    admit: (ADMITTING_RESULTS as readonly TicketScanResult[]).includes(result),
    message,
    ticket: null,
    previousAdmission: null,
    isR18: false,
    canOverride: false,
    ...extras,
  };
}

export async function scanTicket({
  rawToken,
  eventId,
  scannedByUserId,
  deviceLabel,
  override = false,
}: {
  rawToken: string;
  eventId: string;
  scannedByUserId: string;
  deviceLabel?: string | null;
  /** Manager forcing a duplicate through. */
  override?: boolean;
}): Promise<ScanOutcome> {
  const parsed = parseTicketToken(rawToken);

  if (!parsed) {
    await recordFailure({
      eventId,
      result: TicketScanResult.NOT_FOUND,
      scannedByUserId,
      deviceLabel,
      rawToken,
    });
    return outcome(TicketScanResult.NOT_FOUND, "Not an Atmos ticket");
  }

  return db.$transaction(async (tx) => {
    // Serialise concurrent scans of this specific ticket.
    await tx.$queryRaw`SELECT id FROM "ticket" WHERE id = ${parsed.ticketId} FOR UPDATE`;

    const ticket = await tx.ticket.findUnique({
      where: { id: parsed.ticketId },
      include: {
        tier: { select: { name: true } },
        event: { select: { id: true, isR18: true, reentryAllowed: true } },
        order: {
          select: {
            orderNumber: true,
            status: true,
            buyerName: true,
            buyerEmail: true,
            _count: { select: { tickets: true } },
          },
        },
      },
    });

    if (!ticket) {
      await tx.ticketScan.create({
        data: {
          eventId,
          result: TicketScanResult.NOT_FOUND,
          scannedByUserId,
          deviceLabel: deviceLabel ?? null,
          rawToken,
        },
      });
      return outcome(TicketScanResult.NOT_FOUND, "Ticket not found");
    }

    if (!verifyTicketToken(parsed, ticket)) {
      await tx.ticketScan.create({
        data: {
          ticketId: ticket.id,
          eventId,
          result: TicketScanResult.INVALID_SIGNATURE,
          scannedByUserId,
          deviceLabel: deviceLabel ?? null,
          rawToken,
        },
      });
      return outcome(
        TicketScanResult.INVALID_SIGNATURE,
        "Invalid or expired code",
      );
    }

    const position = await tx.ticket.count({
      where: { orderId: ticket.orderId, ticketNumber: { lte: ticket.ticketNumber } },
    });

    const ticketInfo: NonNullable<ScanOutcome["ticket"]> = {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      tierName: ticket.tier.name,
      attendeeName: ticket.attendeeName,
      buyerName: ticket.order.buyerName,
      buyerEmail: ticket.order.buyerEmail,
      orderNumber: ticket.order.orderNumber,
      positionInOrder: `${position} of ${ticket.order._count.tickets}`,
    };

    const base = { ticket: ticketInfo, isR18: ticket.event.isR18 };

    const fail = async (
      result: TicketScanResult,
      message: string,
    ): Promise<ScanOutcome> => {
      await tx.ticketScan.create({
        data: {
          ticketId: ticket.id,
          eventId,
          result,
          scannedByUserId,
          deviceLabel: deviceLabel ?? null,
        },
      });
      return outcome(result, message, base);
    };

    if (ticket.eventId !== eventId) {
      return fail(TicketScanResult.WRONG_EVENT, "Ticket is for another event");
    }
    if (ticket.status === TicketStatus.REFUNDED) {
      return fail(TicketScanResult.REFUNDED_TICKET, "Ticket was refunded");
    }
    if (ticket.status === TicketStatus.VOID) {
      return fail(TicketScanResult.VOIDED, "Ticket was cancelled");
    }
    if (ticket.order.status !== TicketOrderStatus.PAID) {
      return fail(TicketScanResult.ORDER_UNPAID, "Order not paid");
    }

    const priorAdmissions = await tx.ticketScan.findMany({
      where: {
        ticketId: ticket.id,
        result: { in: [...ADMITTING_RESULTS] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        deviceLabel: true,
        scannedByUserId: true,
      },
    });

    // A manager may have reverted a mistaken admission; only count admissions
    // that happened after the most recent revert.
    const lastRevert = await tx.ticketScan.findFirst({
      where: { ticketId: ticket.id, result: TicketScanResult.ADMISSION_REVERTED },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    const liveAdmissions = lastRevert
      ? priorAdmissions.filter((scan) => scan.createdAt > lastRevert.createdAt)
      : priorAdmissions;

    const previous = liveAdmissions[0] ?? null;

    if (previous) {
      const scannedByName = previous.scannedByUserId
        ? ((
            await tx.user.findUnique({
              where: { id: previous.scannedByUserId },
              select: { name: true },
            })
          )?.name ?? null)
        : null;

      const previousAdmission = {
        at: previous.createdAt,
        deviceLabel: previous.deviceLabel,
        scannedByName,
        admissionCount: liveAdmissions.length,
      };

      if (ticket.event.reentryAllowed) {
        await tx.ticketScan.create({
          data: {
            ticketId: ticket.id,
            eventId,
            result: TicketScanResult.REENTRY,
            scannedByUserId,
            deviceLabel: deviceLabel ?? null,
          },
        });
        return outcome(
          TicketScanResult.REENTRY,
          `Re-entry #${liveAdmissions.length + 1}`,
          { ...base, previousAdmission },
        );
      }

      if (override) {
        await tx.ticketScan.create({
          data: {
            ticketId: ticket.id,
            eventId,
            result: TicketScanResult.OVERRIDE_ADMITTED,
            wasOverride: true,
            scannedByUserId,
            deviceLabel: deviceLabel ?? null,
          },
        });
        return outcome(
          TicketScanResult.OVERRIDE_ADMITTED,
          "Admitted by override",
          { ...base, previousAdmission },
        );
      }

      await tx.ticketScan.create({
        data: {
          ticketId: ticket.id,
          eventId,
          result: TicketScanResult.DUPLICATE,
          scannedByUserId,
          deviceLabel: deviceLabel ?? null,
        },
      });
      return outcome(TicketScanResult.DUPLICATE, "Already admitted", {
        ...base,
        previousAdmission,
        canOverride: true,
      });
    }

    await tx.ticketScan.create({
      data: {
        ticketId: ticket.id,
        eventId,
        result: TicketScanResult.ADMITTED,
        scannedByUserId,
        deviceLabel: deviceLabel ?? null,
      },
    });

    return outcome(TicketScanResult.ADMITTED, "Welcome in", base);
  });
}

async function recordFailure({
  eventId,
  result,
  scannedByUserId,
  deviceLabel,
  rawToken,
}: {
  eventId: string;
  result: TicketScanResult;
  scannedByUserId: string;
  deviceLabel?: string | null;
  rawToken: string;
}): Promise<void> {
  await db.ticketScan
    .create({
      data: {
        eventId,
        result,
        scannedByUserId,
        deviceLabel: deviceLabel ?? null,
        // Truncated: a garbage scan can be arbitrarily long.
        rawToken: rawToken.slice(0, 200),
      },
    })
    .catch(() => undefined);
}

/** Live admitted count for an event, respecting reverts. */
export async function admittedCount(eventId: string): Promise<number> {
  const rows = await db.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(DISTINCT s."ticketId")::bigint AS count
    FROM "ticket_scan" s
    WHERE s."eventId" = ${eventId}
      AND s."result" IN ('ADMITTED', 'OVERRIDE_ADMITTED', 'REENTRY')
      AND NOT EXISTS (
        SELECT 1 FROM "ticket_scan" r
        WHERE r."ticketId" = s."ticketId"
          AND r."result" = 'ADMISSION_REVERTED'
          AND r."createdAt" > s."createdAt"
      )
  `;
  return Number(rows[0]?.count ?? 0);
}
