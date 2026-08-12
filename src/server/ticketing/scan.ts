import "server-only";

import {
  type PaymentMethodKind,
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
    accessLevel: string;
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

    const denialRevert = await tx.ticketScan.findFirst({
      where: { ticketId: ticket.id, result: TicketScanResult.DENIAL_REVERTED },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    const denialStands =
      denial !== null &&
      (previous === null || denial.createdAt > previous.createdAt) &&
      (denialRevert === null || denial.createdAt > denialRevert.createdAt);

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
  const [admissions, lastRevert, denial, denialRevert] =
    await Promise.all([
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
    db.ticketScan.findFirst({
      where: { ticketId, result: TicketScanResult.DENIAL_REVERTED },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const live = lastRevert
    ? admissions.filter((scan) => scan.createdAt > lastRevert.createdAt)
    : admissions;
  const latest = live[0] ?? null;

  // A refusal stands until something later overrules it: an admission, or a
  // staffer taking it back. Without the second clause an undo would be written
  // to the log and change nothing, which is worse than not offering it.
  const denialStands =
    denial !== null &&
    (latest === null || denial.createdAt > latest.createdAt) &&
    (denialRevert === null || denial.createdAt > denialRevert.createdAt);

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

export type AdmissionState = { admittedAt: Date | null; deniedAt: Date | null };

/**
 * The standing of one ticket, from its scans alone.
 *
 * The same two rules `ticketState` applies, pulled out as a pure function
 * because they are the easy ones to get subtly wrong: an admission only counts
 * if no *later* revert undid it, and a refusal only stands if nothing admitted
 * them *after* it. Getting either backwards means somebody walks in twice, or
 * gets turned away on a refusal that was already overruled.
 *
 * `rows` must be newest-first.
 */
export function reduceAdmissionState<
  T extends { result: TicketScanResult; createdAt: Date },
>(
  rows: T[],
): AdmissionState & {
  /** The admission that stands, if any — the row behind `admittedAt`. */
  admission: T | null;
  /** The refusal that stands, if any — the row behind `deniedAt`. */
  denial: T | null;
  /** Admissions since the last revert. Two or more means they re-entered. */
  admissionCount: number;
} {
  const admitting = new Set<TicketScanResult>(ADMITTING_RESULTS);

  const admissions = rows.filter((row) => admitting.has(row.result));
  const lastRevert = rows.find(
    (row) => row.result === TicketScanResult.ADMISSION_REVERTED,
  );
  const live = lastRevert
    ? admissions.filter((row) => row.createdAt > lastRevert.createdAt)
    : admissions;
  const latest = live[0] ?? null;

  const denial =
    rows.find((row) => row.result === TicketScanResult.DENIED) ?? null;
  const denialRevert =
    rows.find((row) => row.result === TicketScanResult.DENIAL_REVERTED) ?? null;
  // Same rule as `ticketState`, over rows already in hand.
  const denialStands =
    denial !== null &&
    (latest === null || denial.createdAt > latest.createdAt) &&
    (denialRevert === null || denial.createdAt > denialRevert.createdAt);

  return {
    admittedAt: latest?.createdAt ?? null,
    deniedAt: denialStands && denial ? denial.createdAt : null,
    admission: latest,
    denial: denialStands ? denial : null,
    admissionCount: live.length,
  };
}

/**
 * Where several tickets stand right now, in one pass.
 *
 * Same rules as `ticketState`, but for a whole order at once, so showing the
 * rest of a party costs one query rather than one per companion. Only the two
 * facts a companion row shows are returned; use `ticketState` when the full
 * story — who admitted them, on what device — is needed.
 */
export async function admissionStates(
  ticketIds: string[],
): Promise<Map<string, AdmissionState>> {
  const states = new Map<string, AdmissionState>();
  if (ticketIds.length === 0) return states;

  const scans = await db.ticketScan.findMany({
    where: {
      ticketId: { in: ticketIds },
      result: {
        in: [
          ...ADMITTING_RESULTS,
          TicketScanResult.ADMISSION_REVERTED,
          TicketScanResult.DENIED,
          TicketScanResult.DENIAL_REVERTED,
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    select: { ticketId: true, result: true, createdAt: true },
  });

  // `ticketId` is nullable on the model — a scan of a token that resolved to
  // nothing still gets logged — so the null case is narrowed away here rather
  // than assumed away, even though the `in` filter above can't return one.
  const byTicket = new Map<string, typeof scans>();
  for (const scan of scans) {
    if (scan.ticketId === null) continue;
    const bucket = byTicket.get(scan.ticketId);
    if (bucket) bucket.push(scan);
    else byTicket.set(scan.ticketId, [scan]);
  }

  for (const ticketId of ticketIds) {
    // Buckets keep the newest-first ordering of the query above.
    states.set(ticketId, reduceAdmissionState(byTicket.get(ticketId) ?? []));
  }

  return states;
}

/** Where a check landed, in the terms a door thinks in. */
export type TicketCheckVerdict = "OK" | "ALREADY_IN" | "REFUSED" | "NOT_VALID";

/** One row of a ticket's scan log, ready to read. */
export type TicketScanHistoryEntry = {
  id: string;
  result: TicketScanResult;
  at: Date;
  scannedByName: string | null;
  deviceLabel: string | null;
  wasOverride: boolean;
  denyReason: TicketDenyReason | null;
  denyNote: string | null;
};

export type TicketCheck = {
  found: boolean;
  verdict: TicketCheckVerdict;
  /** The result a scan would produce right now, decided by the same rules. */
  wouldScanAs: TicketScanResult;
  /** Two or three words, big, at the top. */
  headline: string;
  /** The sentence under it. Never contains a time — those go stale. */
  detail: string;
  ticket:
    | (NonNullable<ScanOutcome["ticket"]> & {
        status: TicketStatus;
        paymentMethod: PaymentMethodKind;
      })
    | null;
  admittedAt: Date | null;
  admittedBy: string | null;
  admittedDevice: string | null;
  admissionCount: number;
  /** The refusal standing against this ticket right now, if any. */
  denial: PreviousDenial | null;
  /** Every refusal ever recorded against it, standing or since overruled. */
  refusalCount: number;
  /** Newest first, trimmed for the wire. */
  history: TicketScanHistoryEntry[];
  /** How many scans exist in total, which `history` may be a slice of. */
  scanCount: number;
  isR18: boolean;
  reentryAllowed: boolean;
};

/** A ticket's history is bounded by human behaviour; this is just a backstop. */
const CHECK_HISTORY_LIMIT = 50;

/**
 * Read a ticket without touching it.
 *
 * Every other path in this file writes a `TicketScan` row — that is what they
 * are for. A check must not: it would put rows into the very history it exists
 * to show, and a "did this get used?" would start counting as a use. So this
 * reads and returns, and nothing anywhere moves.
 *
 * The verdict runs the checks in the same order `scanTicket` applies them and
 * is phrased as the result a scan *would* produce, so the door can never be
 * told a ticket is fine here and watch it come back red a moment later.
 */
export async function inspectTicket({
  eventId,
  lookup,
}: {
  eventId: string;
  lookup:
    | { kind: "token"; token: string }
    | { kind: "ticketNumber"; ticketNumber: string };
}): Promise<TicketCheck> {
  const nothing = (headline: string, detail: string): TicketCheck => ({
    found: false,
    verdict: "NOT_VALID",
    wouldScanAs: TicketScanResult.NOT_FOUND,
    headline,
    detail,
    ticket: null,
    admittedAt: null,
    admittedBy: null,
    admittedDevice: null,
    admissionCount: 0,
    denial: null,
    refusalCount: 0,
    history: [],
    scanCount: 0,
    isR18: false,
    reentryAllowed: false,
  });

  const parsed =
    lookup.kind === "token" ? parseTicketToken(lookup.token) : null;
  const ticketNumber =
    lookup.kind === "ticketNumber" ? lookup.ticketNumber.toUpperCase() : null;

  const where = parsed
    ? { id: parsed.ticketId }
    : ticketNumber
      ? { ticketNumber }
      : null;

  if (!where) {
    return nothing(
      "Not an Atmos ticket",
      "That code isn't one of ours. It might be a pass for another event, or any other QR code entirely.",
    );
  }

  const ticket = await db.ticket.findUnique({
    where,
    include: {
      tier: { select: { name: true } },
      event: { select: { id: true, isR18: true, reentryAllowed: true } },
      order: {
        select: {
          orderNumber: true,
          status: true,
          buyerName: true,
          buyerEmail: true,
          paymentMethod: true,
          _count: { select: { tickets: true } },
        },
      },
    },
  });

  if (!ticket) {
    return nothing(
      "No such ticket",
      ticketNumber
        ? `Nothing on record for ${ticketNumber}. Worth a second look for a typo — 0 and O are the usual one.`
        : "This code doesn't match any ticket we've issued.",
    );
  }

  const [position, scans] = await Promise.all([
    db.ticket.count({
      where: {
        orderId: ticket.orderId,
        ticketNumber: { lte: ticket.ticketNumber },
      },
    }),
    // Uncapped: the state below is derived from these rows, and a `take` that
    // cut off an old admission would quietly change the answer.
    db.ticketScan.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        result: true,
        createdAt: true,
        deviceLabel: true,
        wasOverride: true,
        denyReason: true,
        denyNote: true,
        scannedByUserId: true,
      },
    }),
  ]);

  const staffIds = [
    ...new Set(
      scans
        .map((scan) => scan.scannedByUserId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const staff = await db.user.findMany({
    where: { id: { in: staffIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(staff.map((user) => [user.id, user.name]));
  const nameOf = (userId: string | null) =>
    userId ? (nameById.get(userId) ?? null) : null;

  const state = reduceAdmissionState(scans);

  const info: NonNullable<TicketCheck["ticket"]> = {
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
    status: ticket.status,
    paymentMethod: ticket.order.paymentMethod,
  };

  const verdict = ((): Pick<
    TicketCheck,
    "verdict" | "wouldScanAs" | "headline" | "detail"
  > => {
    // A code that no longer matches the ticket it names — reissued, transferred,
    // or forged. Checked first, exactly as a scan checks it first.
    if (parsed && !verifyTicketToken(parsed, ticket)) {
      return {
        verdict: "NOT_VALID",
        wouldScanAs: TicketScanResult.INVALID_SIGNATURE,
        headline: "Code doesn't check out",
        detail:
          "This QR was replaced, so they're holding an old copy. Their ticket may still be fine — look it up by name on the list.",
      };
    }
    if (ticket.eventId !== eventId) {
      return {
        verdict: "NOT_VALID",
        wouldScanAs: TicketScanResult.WRONG_EVENT,
        headline: "Wrong event",
        detail: "This is a real ticket, but it's for a different night.",
      };
    }
    if (ticket.status === TicketStatus.REFUNDED) {
      return {
        verdict: "NOT_VALID",
        wouldScanAs: TicketScanResult.REFUNDED_TICKET,
        headline: "Refunded",
        detail: "The money went back, so this ticket no longer gets them in.",
      };
    }
    if (ticket.status === TicketStatus.VOID) {
      return {
        verdict: "NOT_VALID",
        wouldScanAs: TicketScanResult.VOIDED,
        headline: "Cancelled",
        detail: "This ticket was cancelled and won't scan.",
      };
    }
    if (ticket.order.status !== TicketOrderStatus.PAID) {
      return {
        verdict: "NOT_VALID",
        wouldScanAs: TicketScanResult.ORDER_UNPAID,
        headline: "Not paid for",
        detail:
          "The order behind this ticket never completed. Nothing was charged.",
      };
    }
    if (state.denial) {
      return {
        verdict: "REFUSED",
        wouldScanAs: TicketScanResult.PREVIOUSLY_DENIED,
        headline: "Refused",
        detail:
          "Somebody on the door turned this person away, and that stands until a manager overrides it.",
      };
    }
    if (state.admission) {
      if (ticket.event.reentryAllowed) {
        return {
          verdict: "OK",
          wouldScanAs: TicketScanResult.REENTRY,
          headline: "Valid — already inside",
          detail:
            "Re-entry is on for this event, so this ticket still scans clean.",
        };
      }
      return {
        verdict: "ALREADY_IN",
        wouldScanAs: TicketScanResult.DUPLICATE,
        headline: "Already used",
        detail:
          "Someone came in on this ticket. Scanning it now would be refused unless a manager overrides it.",
      };
    }
    return {
      verdict: "OK",
      wouldScanAs: TicketScanResult.ADMITTED,
      headline: "Valid",
      detail: "Not used yet. Scanning this would let them in.",
    };
  })();

  return {
    ...verdict,
    found: true,
    ticket: info,
    admittedAt: state.admittedAt,
    admittedBy: nameOf(state.admission?.scannedByUserId ?? null),
    admittedDevice: state.admission?.deviceLabel ?? null,
    admissionCount: state.admissionCount,
    denial: state.denial
      ? {
          at: state.denial.createdAt,
          reason: state.denial.denyReason,
          note: state.denial.denyNote,
          deviceLabel: state.denial.deviceLabel,
          scannedByName: nameOf(state.denial.scannedByUserId),
        }
      : null,
    // Every refusal, not just the one standing: "was this person ever knocked
    // back" is a different question from "are they barred right now", and the
    // door asks both.
    refusalCount: scans.filter(
      (scan) => scan.result === TicketScanResult.DENIED,
    ).length,
    history: scans.slice(0, CHECK_HISTORY_LIMIT).map((scan) => ({
      id: scan.id,
      result: scan.result,
      at: scan.createdAt,
      scannedByName: nameOf(scan.scannedByUserId),
      deviceLabel: scan.deviceLabel,
      wasOverride: scan.wasOverride,
      denyReason: scan.denyReason,
      denyNote: scan.denyNote,
    })),
    scanCount: scans.length,
    isR18: ticket.event.isR18,
    reentryAllowed: ticket.event.reentryAllowed,
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
