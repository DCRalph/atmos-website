import "server-only";

import {
  type TicketAccessLevel,
  type TicketDenyReason,
  TicketOrderStatus,
  TicketScanResult,
  TicketStatus,
} from "~Prisma/client";
import { db } from "~/server/db";
import { ticketTypeName } from "~/lib/ticketing/access-levels";
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
 *
 * A valid code is not the same as a valid person, so the door can refuse
 * anyone after the fact (`denyTicket`). That refusal sticks to the ticket: the
 * next scanner sees red and reads back exactly what the last one wrote, which
 * is the only thing that stops a knocked-back punter walking twenty metres to
 * the other scanner and trying again.
 */

/** Results that mean the person is inside. */
export const ADMITTING_RESULTS = [
  TicketScanResult.ADMITTED,
  TicketScanResult.OVERRIDE_ADMITTED,
  TicketScanResult.REENTRY,
] as const;

export type PreviousDenial = {
  at: Date;
  reason: TicketDenyReason | null;
  note: string | null;
  deviceLabel: string | null;
  scannedByName: string | null;
};

export type ScanOutcome = {
  result: TicketScanResult;
  /** Whether the person should be let in. */
  admit: boolean;
  message: string;
  ticket: {
    id: string;
    ticketNumber: string;
    tierName: string;
    /** What this ticket gets them past — which wristband the door hands over. */
    accessLevel: TicketAccessLevel;
    attendeeName: string | null;
    buyerName: string | null;
    buyerEmail: string | null;
    orderNumber: string;
    /** Given away rather than sold. */
    isComp: boolean;
    /** Who put this person on the list, when somebody handed them a ticket. */
    invitedByName: string | null;
    /**
     * The name on this ticket is meant to be the person holding it. The door
     * shows an ID prompt rather than treating the name as decoration.
     */
    nameLocked: boolean;
    /** e.g. "2 of 4" when a group bought together. */
    positionInOrder: string;
  } | null;
  previousAdmission: {
    at: Date;
    deviceLabel: string | null;
    scannedByName: string | null;
    admissionCount: number;
  } | null;
  /** The refusal still standing against this ticket, if there is one. */
  previousDenial: PreviousDenial | null;
  isR18: boolean;
  /** Set when a DUPLICATE or a standing denial could be forced through. */
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
    previousDenial: null,
    isR18: false,
    canOverride: false,
    ...extras,
  };
}

/** `TicketScan.scannedByUserId` is a plain column, so names need a lookup. */
async function staffName(
  tx: Pick<typeof db, "user">,
  userId: string | null,
): Promise<string | null> {
  if (!userId) return null;
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  return user?.name ?? null;
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
      where: {
        orderId: ticket.orderId,
        ticketNumber: { lte: ticket.ticketNumber },
      },
    });

    const ticketInfo: NonNullable<ScanOutcome["ticket"]> = {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      tierName: ticketTypeName(ticket),
      accessLevel: ticket.accessLevel,
      attendeeName: ticket.attendeeName,
      buyerName: ticket.order.buyerName,
      buyerEmail: ticket.order.buyerEmail,
      orderNumber: ticket.order.orderNumber,
      isComp: ticket.isComp,
      // Who put this person on the list. The door is standing in front of
      // somebody they don't recognise, and this is the fact that settles it.
      invitedByName: ticket.invitedByName,
      // Drives the "check their ID" prompt: a locked ticket is one where the
      // name on it is meant to match the person holding it.
      nameLocked: ticket.nameLockedAt !== null,
      // The host is always the first ticket on a grant, so the hand-outs number
      // from there: "handout 1 of 2" rather than a confusing "2 of 3".
      positionInOrder: ticket.hostTicketId
        ? `handout ${position - 1} of ${ticket.order._count.tickets - 1}`
        : `${position} of ${ticket.order._count.tickets}`,
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

    /**
     * Write an admitting scan, and weld the ticket to whoever just walked in.
     *
     * Locking here is what stops a name being fitted to a ticket after it has
     * been used: from this moment the name on it is the record of who came in,
     * so the door has the last word rather than the office. It also ends any
     * chance of the ticket being reassigned out from under an admission.
     */
    const admit = async (
      result: (typeof ADMITTING_RESULTS)[number],
      wasOverride = false,
    ): Promise<void> => {
      await tx.ticketScan.create({
        data: {
          ticketId: ticket.id,
          eventId,
          result,
          wasOverride,
          scannedByUserId,
          deviceLabel: deviceLabel ?? null,
        },
      });
      if (!ticket.nameLockedAt) {
        await tx.ticket.update({
          where: { id: ticket.id },
          data: { nameLockedAt: new Date() },
        });
      }
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
      where: {
        ticketId: ticket.id,
        result: TicketScanResult.ADMISSION_REVERTED,
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    const liveAdmissions = lastRevert
      ? priorAdmissions.filter((scan) => scan.createdAt > lastRevert.createdAt)
      : priorAdmissions;

    const previous = liveAdmissions[0] ?? null;

    // A refusal outranks everything below it until somebody deliberately
    // admits the ticket afterwards.
    const denial = await tx.ticketScan.findFirst({
      where: { ticketId: ticket.id, result: TicketScanResult.DENIED },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        denyReason: true,
        denyNote: true,
        deviceLabel: true,
        scannedByUserId: true,
      },
    });

    const denialStands =
      denial !== null &&
      (previous === null || denial.createdAt > previous.createdAt);

    if (denialStands) {
      const previousDenial: PreviousDenial = {
        at: denial.createdAt,
        reason: denial.denyReason,
        note: denial.denyNote,
        deviceLabel: denial.deviceLabel,
        scannedByName: await staffName(tx, denial.scannedByUserId),
      };

      if (!override) {
        await tx.ticketScan.create({
          data: {
            ticketId: ticket.id,
            eventId,
            result: TicketScanResult.PREVIOUSLY_DENIED,
            scannedByUserId,
            deviceLabel: deviceLabel ?? null,
          },
        });
        return outcome(
          TicketScanResult.PREVIOUSLY_DENIED,
          "Refused entry earlier",
          { ...base, previousDenial, canOverride: true },
        );
      }

      await admit(TicketScanResult.OVERRIDE_ADMITTED, true);
      return outcome(
        TicketScanResult.OVERRIDE_ADMITTED,
        "Admitted despite earlier refusal",
        { ...base, previousDenial },
      );
    }

    if (previous) {
      const previousAdmission = {
        at: previous.createdAt,
        deviceLabel: previous.deviceLabel,
        scannedByName: await staffName(tx, previous.scannedByUserId),
        admissionCount: liveAdmissions.length,
      };

      if (ticket.event.reentryAllowed) {
        await admit(TicketScanResult.REENTRY);
        return outcome(
          TicketScanResult.REENTRY,
          `Re-entry #${liveAdmissions.length + 1}`,
          { ...base, previousAdmission },
        );
      }

      if (override) {
        await admit(TicketScanResult.OVERRIDE_ADMITTED, true);
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

    await admit(TicketScanResult.ADMITTED);

    return outcome(TicketScanResult.ADMITTED, "Welcome in", base);
  });
}

/**
 * The door turning someone away.
 *
 * Runs after a scan that already came back fine, so this is a decision about
 * the person, not the code. Any door staff can make it — refusing entry is the
 * job — and it is recorded against the ticket so the next scanner sees it.
 *
 * If the ticket was admitted moments earlier the admission is reverted in the
 * same breath: they were let in and then turned around, so the headcount and
 * the door list must not keep claiming they're inside.
 */
export async function denyTicket({
  ticketId,
  eventId,
  reason,
  note,
  scannedByUserId,
  deviceLabel,
}: {
  ticketId: string;
  eventId: string;
  reason: TicketDenyReason;
  note?: string | null;
  scannedByUserId: string;
  deviceLabel?: string | null;
}): Promise<ScanOutcome> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ticket" WHERE id = ${ticketId} FOR UPDATE`;

    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      include: {
        tier: { select: { name: true } },
        event: { select: { isR18: true } },
        order: {
          select: {
            orderNumber: true,
            buyerName: true,
            buyerEmail: true,
            _count: { select: { tickets: true } },
          },
        },
      },
    });

    if (!ticket || ticket.eventId !== eventId) {
      return outcome(TicketScanResult.NOT_FOUND, "Ticket not found");
    }

    const position = await tx.ticket.count({
      where: {
        orderId: ticket.orderId,
        ticketNumber: { lte: ticket.ticketNumber },
      },
    });

    const denial = await tx.ticketScan.create({
      data: {
        ticketId: ticket.id,
        eventId,
        result: TicketScanResult.DENIED,
        denyReason: reason,
        denyNote: note?.trim() ? note.trim() : null,
        scannedByUserId,
        deviceLabel: deviceLabel ?? null,
      },
      select: {
        createdAt: true,
        denyReason: true,
        denyNote: true,
        deviceLabel: true,
      },
    });

    const admittedEarlier = await tx.ticketScan.findFirst({
      where: { ticketId: ticket.id, result: { in: [...ADMITTING_RESULTS] } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const revertedEarlier = await tx.ticketScan.findFirst({
      where: {
        ticketId: ticket.id,
        result: TicketScanResult.ADMISSION_REVERTED,
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    const wasInside =
      admittedEarlier !== null &&
      (revertedEarlier === null ||
        admittedEarlier.createdAt > revertedEarlier.createdAt);

    if (wasInside) {
      await tx.ticketScan.create({
        data: {
          ticketId: ticket.id,
          eventId,
          result: TicketScanResult.ADMISSION_REVERTED,
          scannedByUserId,
          deviceLabel: deviceLabel ?? null,
        },
      });
    }

    return outcome(TicketScanResult.DENIED, "Entry refused", {
      ticket: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        tierName: ticketTypeName(ticket),
        accessLevel: ticket.accessLevel,
        attendeeName: ticket.attendeeName,
        buyerName: ticket.order.buyerName,
        buyerEmail: ticket.order.buyerEmail,
        orderNumber: ticket.order.orderNumber,
        isComp: ticket.isComp,
        invitedByName: ticket.invitedByName,
        nameLocked: ticket.nameLockedAt !== null,
        positionInOrder: ticket.hostTicketId
          ? `handout ${position - 1} of ${ticket.order._count.tickets - 1}`
          : `${position} of ${ticket.order._count.tickets}`,
      },
      isR18: ticket.event.isR18,
      previousDenial: {
        at: denial.createdAt,
        reason: denial.denyReason,
        note: denial.denyNote,
        deviceLabel: denial.deviceLabel,
        scannedByName: await staffName(tx, scannedByUserId),
      },
    });
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

/**
 * Where a ticket stands right now, without recording anything.
 *
 * The door list needs the same answer the scanner computes — is this person
 * in, and is there a refusal standing against them — and the two must not be
 * allowed to disagree, so both read the rules from here.
 */
export async function ticketState(ticketId: string): Promise<{
  admittedAt: Date | null;
  admittedBy: string | null;
  admittedDevice: string | null;
  admissionCount: number;
  denial: PreviousDenial | null;
}> {
  const [admissions, lastRevert, denial] = await Promise.all([
    db.ticketScan.findMany({
      where: { ticketId, result: { in: [...ADMITTING_RESULTS] } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, deviceLabel: true, scannedByUserId: true },
    }),
    db.ticketScan.findFirst({
      where: { ticketId, result: TicketScanResult.ADMISSION_REVERTED },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    db.ticketScan.findFirst({
      where: { ticketId, result: TicketScanResult.DENIED },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        denyReason: true,
        denyNote: true,
        deviceLabel: true,
        scannedByUserId: true,
      },
    }),
  ]);

  const live = lastRevert
    ? admissions.filter((scan) => scan.createdAt > lastRevert.createdAt)
    : admissions;
  const latest = live[0] ?? null;

  const denialStands =
    denial !== null && (latest === null || denial.createdAt > latest.createdAt);

  return {
    admittedAt: latest?.createdAt ?? null,
    admittedBy: await staffName(db, latest?.scannedByUserId ?? null),
    admittedDevice: latest?.deviceLabel ?? null,
    admissionCount: live.length,
    denial:
      denialStands && denial
        ? {
            at: denial.createdAt,
            reason: denial.denyReason,
            note: denial.denyNote,
            deviceLabel: denial.deviceLabel,
            scannedByName: await staffName(db, denial.scannedByUserId),
          }
        : null,
  };
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
