import "server-only";

import {
  LifetimeTicketStatus,
  type PaymentMethodKind,
  type Prisma,
  type TicketDenyReason,
  TicketOrderStatus,
  TicketScanResult,
  TicketStatus,
} from "~Prisma/client";
import { db } from "~/server/db";
import { ticketTypeName } from "~/lib/ticketing/access-levels";
import {
  parseToken,
  verifyLifetimeToken,
  verifyTicketToken,
  type ParsedLifetimeToken,
} from "~/server/ticketing/qr";
import { materialiseLifetimeTicket } from "~/server/ticketing/lifetime";
import { looksLikeLifetimeNumber } from "~/server/ticketing/numbering";

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
 *
 * A lifetime pass comes through the same door. Its token names a pass rather
 * than a ticket, so the scan first turns the pass into this event's ticket
 * (minting one on the first scan of the night — see
 * `~/server/ticketing/lifetime`) and then decides exactly as it would for any
 * other ticket. One set of rules, whatever was scanned.
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

/** The pass behind a scan, when a lifetime pass is what was scanned. */
export type LifetimeInfo = {
  id: string;
  number: string;
  holderName: string;
};

export type ScanOutcome = {
  result: TicketScanResult;
  /** Whether the person should be let in. */
  admit: boolean;
  message: string;
  /**
   * Set whenever the code was a lifetime pass, whether or not it got as far as
   * a ticket — a revoked pass has no ticket to show but the door still has to
   * be told what it is looking at.
   */
  lifetime: LifetimeInfo | null;
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
    lifetime: null,
    ticket: null,
    previousAdmission: null,
    previousDenial: null,
    isR18: false,
    canOverride: false,
    ...extras,
  };
}

/**
 * Everything a scan, a refusal and a check load about a ticket.
 *
 * One shape, so the three of them cannot drift — and so `ticketInfo` below
 * can be the single place a ticket is turned into what the door displays.
 */
const SCAN_TICKET_INCLUDE = {
  tier: { select: { name: true } },
  lifetimeTicket: { select: { id: true, number: true, holderName: true } },
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
} satisfies Prisma.TicketInclude;

type ScanTicket = Prisma.TicketGetPayload<{
  include: typeof SCAN_TICKET_INCLUDE;
}>;

type Reader = Pick<typeof db, "ticket" | "ticketScan" | "user">;

function loadScanTicket(
  tx: Reader,
  where: { id: string } | { ticketNumber: string },
): Promise<ScanTicket | null> {
  return tx.ticket.findUnique({ where, include: SCAN_TICKET_INCLUDE });
}

/** "2 of 4": where this ticket sits on its order. */
function orderPosition(tx: Reader, ticket: ScanTicket): Promise<number> {
  return tx.ticket.count({
    where: {
      orderId: ticket.orderId,
      ticketNumber: { lte: ticket.ticketNumber },
    },
  });
}

/** What the door shows about a ticket, from the row. */
function ticketInfo(
  ticket: ScanTicket,
  position: number,
): NonNullable<ScanOutcome["ticket"]> {
  return {
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

type ScanArgs = {
  eventId: string;
  scannedByUserId: string;
  deviceLabel?: string | null;
  /** Manager forcing a duplicate through. */
  override?: boolean;
};

export async function scanTicket({
  rawToken,
  eventId,
  scannedByUserId,
  deviceLabel,
  override = false,
}: ScanArgs & { rawToken: string }): Promise<ScanOutcome> {
  const parsed = parseToken(rawToken);

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

  if (parsed.kind === "lifetime") {
    return scanLifetime(parsed, {
      rawToken,
      eventId,
      scannedByUserId,
      deviceLabel,
      override,
    });
  }

  return db.$transaction(async (tx) => {
    // Serialise concurrent scans of this specific ticket.
    await tx.$queryRaw`SELECT id FROM "ticket" WHERE id = ${parsed.ticketId} FOR UPDATE`;

    const ticket = await loadScanTicket(tx, { id: parsed.ticketId });

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

    return decideAdmission(tx, ticket, {
      eventId,
      scannedByUserId,
      deviceLabel,
      override,
    });
  });
}

/**
 * A lifetime pass at the door.
 *
 * The pass row is locked rather than a ticket row, because until the first
 * scan of the night there is no ticket: two doors scanning the same pass at
 * the same instant must mint one ticket between them, and the lock is what
 * makes the second one find it. Revocation is checked before anything is
 * minted, so a revoked pass never gains a ticket it could be argued in on.
 */
async function scanLifetime(
  parsed: ParsedLifetimeToken,
  {
    rawToken,
    eventId,
    scannedByUserId,
    deviceLabel,
    override = false,
  }: ScanArgs & { rawToken: string },
): Promise<ScanOutcome> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "lifetime_ticket" WHERE id = ${parsed.lifetimeId} FOR UPDATE`;

    const lifetime = await tx.lifetimeTicket.findUnique({
      where: { id: parsed.lifetimeId },
    });

    // Failures before a ticket exists are logged against the event alone, as
    // an unknown code would be — the raw token is what makes them auditable.
    const bare = (result: TicketScanResult) =>
      tx.ticketScan.create({
        data: {
          eventId,
          result,
          scannedByUserId,
          deviceLabel: deviceLabel ?? null,
          rawToken,
        },
      });

    if (!lifetime) {
      await bare(TicketScanResult.NOT_FOUND);
      return outcome(TicketScanResult.NOT_FOUND, "Lifetime pass not found");
    }

    const info: LifetimeInfo = {
      id: lifetime.id,
      number: lifetime.number,
      holderName: lifetime.holderName,
    };

    if (!verifyLifetimeToken(parsed, lifetime)) {
      await bare(TicketScanResult.INVALID_SIGNATURE);
      return outcome(
        TicketScanResult.INVALID_SIGNATURE,
        "Invalid or expired code",
        { lifetime: info },
      );
    }

    if (lifetime.status === LifetimeTicketStatus.REVOKED) {
      // Against this event's ticket if the pass was used here before it was
      // revoked, so the attempt lands in that ticket's history too.
      const existing = await tx.ticket.findUnique({
        where: {
          lifetimeTicketId_eventId: { lifetimeTicketId: lifetime.id, eventId },
        },
        select: { id: true },
      });
      await tx.ticketScan.create({
        data: {
          ticketId: existing?.id ?? null,
          eventId,
          result: TicketScanResult.VOIDED,
          scannedByUserId,
          deviceLabel: deviceLabel ?? null,
          rawToken,
        },
      });
      return outcome(TicketScanResult.VOIDED, "Lifetime pass revoked", {
        lifetime: info,
      });
    }

    const { ticketId } = await materialiseLifetimeTicket(tx, lifetime, eventId);

    // The pass lock covers the mint; the ticket lock covers the decision, the
    // same way it does for a ticket scanned by its own code. Always taken in
    // this order, pass then ticket, so two lifetime scans cannot deadlock.
    await tx.$queryRaw`SELECT id FROM "ticket" WHERE id = ${ticketId} FOR UPDATE`;
    const ticket = await loadScanTicket(tx, { id: ticketId });
    if (!ticket) {
      // Cannot happen inside the transaction that just minted it; handled so
      // the type narrows rather than because it is expected.
      await bare(TicketScanResult.NOT_FOUND);
      return outcome(TicketScanResult.NOT_FOUND, "Ticket not found", {
        lifetime: info,
      });
    }

    return decideAdmission(tx, ticket, {
      eventId,
      scannedByUserId,
      deviceLabel,
      override,
    });
  });
}

/**
 * The admit decision for a ticket already loaded and locked.
 *
 * Everything after "is this a real code" lives here, so a ticket scanned by
 * its own QR and a lifetime pass turned into a ticket are judged by exactly
 * the same rules.
 */
async function decideAdmission(
  tx: Prisma.TransactionClient,
  ticket: ScanTicket,
  { eventId, scannedByUserId, deviceLabel, override = false }: ScanArgs,
): Promise<ScanOutcome> {
  const position = await orderPosition(tx, ticket);

  const base = {
    ticket: ticketInfo(ticket, position),
    lifetime: ticket.lifetimeTicket,
    isR18: ticket.event.isR18,
  };

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

  // Somebody may also have marked them out of the building. That does not
  // undo the admission — it ends it — so the two are tracked apart.
  const lastDeparture = await tx.ticketScan.findFirst({
    where: { ticketId: ticket.id, result: TicketScanResult.DEPARTED },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  const liveAdmissions = lastRevert
    ? priorAdmissions.filter((scan) => scan.createdAt > lastRevert.createdAt)
    : priorAdmissions;

  /**
   * The last admission that counts, whether or not they are still inside.
   *
   * This is the one a refusal is measured against: being let in after a
   * refusal overrules it, and walking back out later does not bring it back.
   */
  const lastAdmission = liveAdmissions[0] ?? null;

  // Admissions that still have them in the building. A departure ends the
  // ones before it, so `previous` is presence, not history.
  const insideAdmissions = lastDeparture
    ? liveAdmissions.filter((scan) => scan.createdAt > lastDeparture.createdAt)
    : liveAdmissions;

  const previous = insideAdmissions[0] ?? null;
  /** Been in, marked out, now standing at the door again. */
  const departed = previous === null && lastAdmission !== null;

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
    (lastAdmission === null || denial.createdAt > lastAdmission.createdAt) &&
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

  /**
   * They were in, somebody marked them out, and here they are again.
   *
   * Admitted regardless of what the event says about re-entry: marking
   * somebody out is the deliberate act that grants the return, and turning
   * them away at the door afterwards would make the whole thing a trap for
   * the staffer who did it.
   */
  if (departed) {
    await admit(TicketScanResult.REENTRY);
    return outcome(
      TicketScanResult.REENTRY,
      `Back in — re-entry #${liveAdmissions.length + 1}`,
      {
        ...base,
        previousAdmission: {
          at: lastAdmission.createdAt,
          deviceLabel: lastAdmission.deviceLabel,
          scannedByName: await staffName(tx, lastAdmission.scannedByUserId),
          admissionCount: liveAdmissions.length,
        },
      },
    );
  }

  await admit(TicketScanResult.ADMITTED);

  return outcome(TicketScanResult.ADMITTED, "Welcome in", base);
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

    const ticket = await loadScanTicket(tx, { id: ticketId });

    if (ticket?.eventId !== eventId) {
      return outcome(TicketScanResult.NOT_FOUND, "Ticket not found");
    }

    const position = await orderPosition(tx, ticket);

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
      ticket: ticketInfo(ticket, position),
      lifetime: ticket.lifetimeTicket,
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
  /** Set when they were let in and a staffer has since marked them out. */
  departedAt: Date | null;
  departedBy: string | null;
  denial: PreviousDenial | null;
}> {
  const [admissions, lastRevert, lastDeparture, denial, denialRevert] =
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
        where: { ticketId, result: TicketScanResult.DEPARTED },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, scannedByUserId: true },
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
  /** The last admission that counts, in or out. */
  const lastAdmission = live[0] ?? null;

  // Presence, which a departure ends without undoing anything.
  const inside = lastDeparture
    ? live.filter((scan) => scan.createdAt > lastDeparture.createdAt)
    : live;
  const latest = inside[0] ?? null;
  const departed = latest === null && lastAdmission !== null;

  // A refusal stands until something later overrules it: an admission, or a
  // staffer taking it back. Without the second clause an undo would be written
  // to the log and change nothing, which is worse than not offering it.
  //
  // Measured against `lastAdmission` rather than presence: being let in after a
  // refusal overrules it, and leaving later does not bring it back.
  const denialStands =
    denial !== null &&
    (lastAdmission === null || denial.createdAt > lastAdmission.createdAt) &&
    (denialRevert === null || denial.createdAt > denialRevert.createdAt);

  return {
    admittedAt: latest?.createdAt ?? null,
    admittedBy: await staffName(db, latest?.scannedByUserId ?? null),
    departedAt: departed ? (lastDeparture?.createdAt ?? null) : null,
    departedBy: departed
      ? await staffName(db, lastDeparture?.scannedByUserId ?? null)
      : null,
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

export type AdmissionState = {
  /** When they came in, and are still in. Null once they've been marked out. */
  admittedAt: Date | null;
  /** When a staffer marked them out of the building, if they haven't returned. */
  departedAt: Date | null;
  deniedAt: Date | null;
};

/**
 * The standing of one ticket, from its scans alone.
 *
 * The same rules `ticketState` applies, pulled out as a pure function because
 * they are the easy ones to get subtly wrong: an admission only counts if no
 * *later* revert undid it, presence ends at a departure without the admission
 * itself being undone, and a refusal only stands if nothing admitted them
 * *after* it. Getting any of them backwards means somebody walks in twice, or
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
  /** The departure that stands, if any — the row behind `departedAt`. */
  departure: T | null;
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
  /** The last admission that counts, whether or not they are still inside. */
  const lastAdmission = live[0] ?? null;

  // A departure ends the admissions before it without undoing them, so
  // presence and history part company here.
  const lastDeparture =
    rows.find((row) => row.result === TicketScanResult.DEPARTED) ?? null;
  const inside = lastDeparture
    ? live.filter((row) => row.createdAt > lastDeparture.createdAt)
    : live;
  const latest = inside[0] ?? null;
  const departed = latest === null && lastAdmission !== null;

  const denial =
    rows.find((row) => row.result === TicketScanResult.DENIED) ?? null;
  const denialRevert =
    rows.find((row) => row.result === TicketScanResult.DENIAL_REVERTED) ?? null;
  // Same rule as `ticketState`, over rows already in hand — and measured
  // against the last admission rather than presence, so walking out does not
  // resurrect a refusal an admission had already overruled.
  const denialStands =
    denial !== null &&
    (lastAdmission === null || denial.createdAt > lastAdmission.createdAt) &&
    (denialRevert === null || denial.createdAt > denialRevert.createdAt);

  return {
    admittedAt: latest?.createdAt ?? null,
    departedAt: departed && lastDeparture ? lastDeparture.createdAt : null,
    deniedAt: denialStands && denial ? denial.createdAt : null,
    admission: latest,
    departure: departed ? lastDeparture : null,
    denial: denialStands ? denial : null,
    admissionCount: live.length,
  };
}

/**
 * Where several tickets stand right now, in one pass.
 *
 * Same rules as `ticketState`, but for a whole list at once, so showing the
 * rest of a party — or a page of the door list — costs one query rather than
 * one per row. Only the three facts a row shows are returned; use
 * `ticketState` when the full story — who admitted them, on what device — is
 * needed.
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
          TicketScanResult.DEPARTED,
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
  /** The pass, when what was checked is a lifetime pass. */
  lifetime: LifetimeInfo | null;
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
  /** Set when they were let in and a staffer has since marked them out. */
  departedAt: Date | null;
  departedBy: string | null;
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
    lifetime: null,
    ticket: null,
    admittedAt: null,
    admittedBy: null,
    admittedDevice: null,
    admissionCount: 0,
    departedAt: null,
    departedBy: null,
    denial: null,
    refusalCount: 0,
    history: [],
    scanCount: 0,
    isR18: false,
    reentryAllowed: false,
  });

  const parsed = lookup.kind === "token" ? parseToken(lookup.token) : null;
  const ticketNumber =
    lookup.kind === "ticketNumber" ? lookup.ticketNumber.toUpperCase() : null;

  if (lookup.kind === "token" && !parsed) {
    return nothing(
      "Not an Atmos ticket",
      "That code isn't one of ours. It might be a pass for another event, or any other QR code entirely.",
    );
  }

  /**
   * A lifetime pass, by its code or its number.
   *
   * Resolved to this event's ticket if it has one — after which it is read
   * exactly like any other ticket — and otherwise answered from the pass
   * alone. Nothing is minted here: a check must not create the ticket a scan
   * would.
   */
  let lifetimeInfo: LifetimeInfo | null = null;
  let where: { id: string } | { ticketNumber: string };

  const lifetimeWhere =
    parsed?.kind === "lifetime"
      ? { id: parsed.lifetimeId }
      : ticketNumber && looksLikeLifetimeNumber(ticketNumber)
        ? { number: ticketNumber }
        : null;

  if (lifetimeWhere) {
    const lifetime = await db.lifetimeTicket.findUnique({
      where: lifetimeWhere,
      include: { tickets: { where: { eventId }, select: { id: true } } },
    });
    if (!lifetime) {
      return nothing(
        "No such lifetime pass",
        ticketNumber
          ? `Nothing on record for ${ticketNumber}. Worth a second look for a typo — 0 and O are the usual one.`
          : "This code doesn't match any lifetime pass we've issued.",
      );
    }

    lifetimeInfo = {
      id: lifetime.id,
      number: lifetime.number,
      holderName: lifetime.holderName,
    };
    const fromPass = (verdict: {
      verdict?: TicketCheckVerdict;
      wouldScanAs: TicketScanResult;
      headline: string;
      detail: string;
    }): TicketCheck => ({
      ...nothing(verdict.headline, verdict.detail),
      ...verdict,
      found: true,
      lifetime: lifetimeInfo,
    });

    if (parsed?.kind === "lifetime" && !verifyLifetimeToken(parsed, lifetime)) {
      return fromPass({
        wouldScanAs: TicketScanResult.INVALID_SIGNATURE,
        headline: "Code doesn't check out",
        detail:
          "This pass's QR was reissued, so they're holding an old copy. Look the pass up by its number instead.",
      });
    }
    if (lifetime.status === LifetimeTicketStatus.REVOKED) {
      return fromPass({
        wouldScanAs: TicketScanResult.VOIDED,
        headline: "Revoked",
        detail: "This lifetime pass has been revoked and won't scan.",
      });
    }

    const eventTicket = lifetime.tickets[0];
    if (!eventTicket) {
      return fromPass({
        verdict: "OK",
        wouldScanAs: TicketScanResult.ADMITTED,
        headline: "Valid",
        detail:
          "Lifetime pass, not used at this event yet. Scanning it would let them in.",
      });
    }
    where = { id: eventTicket.id };
  } else if (parsed?.kind === "ticket") {
    where = { id: parsed.ticketId };
  } else if (ticketNumber) {
    where = { ticketNumber };
  } else {
    return nothing(
      "Not an Atmos ticket",
      "That code isn't one of ours. It might be a pass for another event, or any other QR code entirely.",
    );
  }

  const ticket = await loadScanTicket(db, where);

  if (!ticket) {
    return nothing(
      "No such ticket",
      ticketNumber
        ? `Nothing on record for ${ticketNumber}. Worth a second look for a typo — 0 and O are the usual one.`
        : "This code doesn't match any ticket we've issued.",
    );
  }

  const [position, scans] = await Promise.all([
    orderPosition(db, ticket),
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
    ...ticketInfo(ticket, position),
    status: ticket.status,
    paymentMethod: ticket.order.paymentMethod,
  };

  const verdict = ((): Pick<
    TicketCheck,
    "verdict" | "wouldScanAs" | "headline" | "detail"
  > => {
    // A code that no longer matches the ticket it names — reissued, transferred,
    // or forged. Checked first, exactly as a scan checks it first.
    if (parsed?.kind === "ticket" && !verifyTicketToken(parsed, ticket)) {
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
    if (state.departedAt) {
      return {
        verdict: "OK",
        wouldScanAs: TicketScanResult.REENTRY,
        headline: "Valid — out at the moment",
        detail:
          "They came in and a staffer marked them out, so this scans clean on the way back.",
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
    lifetime: lifetimeInfo ?? ticket.lifetimeTicket,
    ticket: info,
    admittedAt: state.admittedAt,
    admittedBy: nameOf(state.admission?.scannedByUserId ?? null),
    admittedDevice: state.admission?.deviceLabel ?? null,
    admissionCount: state.admissionCount,
    departedAt: state.departedAt,
    departedBy: nameOf(state.departure?.scannedByUserId ?? null),
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

/**
 * How many people are in the building right now.
 *
 * Reverts and departures both take somebody out of it, for different reasons —
 * one says the admission never counted, the other that they have gone — and
 * either way they are not inside, which is the number a door needs when it is
 * watching a capacity.
 */
export async function admittedCount(eventId: string): Promise<number> {
  const rows = await db.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(DISTINCT s."ticketId")::bigint AS count
    FROM "ticket_scan" s
    WHERE s."eventId" = ${eventId}
      AND s."result" IN ('ADMITTED', 'OVERRIDE_ADMITTED', 'REENTRY')
      AND NOT EXISTS (
        SELECT 1 FROM "ticket_scan" r
        WHERE r."ticketId" = s."ticketId"
          AND r."result" IN ('ADMISSION_REVERTED', 'DEPARTED')
          AND r."createdAt" > s."createdAt"
      )
  `;
  return Number(rows[0]?.count ?? 0);
}

/**
 * How many people came in and have since gone.
 *
 * The mirror of `admittedCount`, and it exists because that number alone
 * cannot tell a difference that matters on the night: a room reading 300 of
 * 500 is a very different evening depending on whether the other 200 never
 * turned up or have already left. Departures are invisible in the headcount by
 * design — the whole point is that they are not inside.
 *
 * A departure only stands while it is the last word on that ticket. Scanning
 * back in makes them present again, so a later admission cancels it; a later
 * `ADMISSION_REVERTED` cancels it too, for the different reason that the
 * admission it ended is now saying it never counted, which leaves nothing to
 * have departed from.
 */
export async function departedCount(eventId: string): Promise<number> {
  const rows = await db.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(DISTINCT s."ticketId")::bigint AS count
    FROM "ticket_scan" s
    WHERE s."eventId" = ${eventId}
      AND s."result" = 'DEPARTED'
      AND NOT EXISTS (
        SELECT 1 FROM "ticket_scan" r
        WHERE r."ticketId" = s."ticketId"
          AND r."result" IN (
            'ADMITTED', 'OVERRIDE_ADMITTED', 'REENTRY', 'ADMISSION_REVERTED'
          )
          AND r."createdAt" > s."createdAt"
      )
  `;
  return Number(rows[0]?.count ?? 0);
}
