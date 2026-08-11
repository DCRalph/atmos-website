import "server-only";

import { TRPCError } from "@trpc/server";

import {
  PaymentMethodKind,
  type Prisma,
  type TicketAccessLevel,
  TicketOrderStatus,
  TicketStatus,
} from "~Prisma/client";
import { db } from "~/server/db";
import {
  eventHeadcount,
  withEventInventoryLock,
} from "~/server/ticketing/inventory";
import {
  buildTicketNumber,
  generateOrderNumber,
} from "~/server/ticketing/numbering";
import { maybeMarkSoldOut, ticketAccessToken } from "~/server/ticketing/orders";
import { generateQrSecret } from "~/server/ticketing/qr";
import { ticketUrl } from "~/server/ticketing/urls";
import { ADMITTING_RESULTS } from "~/server/ticketing/scan";

/**
 * Giving tickets away.
 *
 * Two things make this its own module rather than a flavour of a sale.
 *
 * A comp is **minted, not drawn**: it belongs to no tier, so it can be any
 * access level whether or not a tier sells that level, and it consumes no
 * allocation. Nobody sells an AAA tier, but every show has an artist who needs
 * one.
 *
 * And a comp is **welded to a person**. An artist who needs an AAA and two GAs
 * for friends gets three tickets in one grant: theirs carries their name and is
 * locked at issue, and the other two are separate tickets with their own links,
 * which they name and send on. Passing their own ticket to somebody else is
 * pointless, because it still turns up at the door in their name — which is why
 * this never has to police them.
 *
 * The level lives on the ticket from the moment it is minted, and nothing in
 * the hand-out flow can change it. A GA hand-out cannot become an AAA.
 */

type Tx = Prisma.TransactionClient;

// ------------------------------------------------------------------ counting

export type CompAccounting = {
  /** The budget, or null if nobody set one. */
  allowance: number | null;
  /** Valid comp tickets: hosts and hand-outs together. */
  issued: number;
  /** Named recipients — the people a grant was made to. */
  hosts: number;
  handouts: { total: number; sent: number; unsent: number };
  byLevel: Partial<Record<TicketAccessLevel, number>>;
  /** Comps that actually turned up. */
  admitted: number;
  /** 0 when within budget, else how far past it. */
  overAllowanceBy: number;

  capacity: number | null;
  /** Sold + held + comped. Everyone the event is committed to. */
  headcount: number;
  /** Still sellable to the public. Null when the event has no cap. */
  remainingForSale: number | null;
  /** 0 when within the cap, else how far past it. */
  overCapacityBy: number;
};

/**
 * Every comp number for an event, from one place.
 *
 * The panel, the confirm dialog, the event overview and the analytics tiles all
 * read this. Three callers each doing their own arithmetic will disagree
 * eventually, and the door is where you would find out.
 */
export async function compAccounting(
  eventId: string,
  client: Tx = db,
): Promise<CompAccounting> {
  const event = await client.ticketEvent.findUniqueOrThrow({
    where: { id: eventId },
    select: { capacity: true, compAllowance: true },
  });

  const [{ headcount }, comps, admitted] = await Promise.all([
    eventHeadcount(client, eventId),
    client.ticket.findMany({
      where: { eventId, isComp: true, status: TicketStatus.VALID },
      select: {
        accessLevel: true,
        hostTicketId: true,
        sentAt: true,
      },
    }),
    client.ticket.count({
      where: {
        eventId,
        isComp: true,
        status: TicketStatus.VALID,
        scans: { some: { result: { in: [...ADMITTING_RESULTS] } } },
      },
    }),
  ]);

  const byLevel: Partial<Record<TicketAccessLevel, number>> = {};
  let hosts = 0;
  let handoutsSent = 0;
  let handoutsTotal = 0;

  for (const comp of comps) {
    byLevel[comp.accessLevel] = (byLevel[comp.accessLevel] ?? 0) + 1;
    if (comp.hostTicketId) {
      handoutsTotal++;
      if (comp.sentAt) handoutsSent++;
    } else {
      hosts++;
    }
  }

  const issued = comps.length;
  const allowance = event.compAllowance;
  const capacity = event.capacity;

  return {
    allowance,
    issued,
    hosts,
    handouts: {
      total: handoutsTotal,
      sent: handoutsSent,
      unsent: handoutsTotal - handoutsSent,
    },
    byLevel,
    admitted,
    overAllowanceBy: allowance === null ? 0 : Math.max(0, issued - allowance),
    capacity,
    headcount,
    remainingForSale:
      capacity === null ? null : Math.max(0, capacity - headcount),
    overCapacityBy: capacity === null ? 0 : Math.max(0, headcount - capacity),
  };
}

// ------------------------------------------------------------------ overage

export type OverageReason = "ALLOWANCE" | "CAPACITY";

/**
 * Raised when a grant would push past the comp allowance or the venue capacity.
 *
 * Never a refusal — the caller re-sends with `acknowledge` and it goes through.
 * The decision to comp one more person is made in the room, and this is only
 * here so nobody makes it by accident.
 */
export class CompOverageError extends TRPCError {
  constructor(
    readonly reasons: OverageReason[],
    readonly accounting: CompAccounting,
    readonly requested: number,
  ) {
    super({
      code: "PRECONDITION_FAILED",
      message: describeOverage(reasons, accounting, requested),
    });
    this.name = "CompOverageError";
  }
}

/** The sentence the confirm dialog shows. */
export function describeOverage(
  reasons: OverageReason[],
  accounting: CompAccounting,
  requested: number,
): string {
  const parts: string[] = [];

  if (reasons.includes("ALLOWANCE") && accounting.allowance !== null) {
    const over = accounting.issued + requested - accounting.allowance;
    parts.push(`${over} over your ${accounting.allowance}-comp allowance`);
  }
  if (reasons.includes("CAPACITY") && accounting.capacity !== null) {
    const over = accounting.headcount + requested - accounting.capacity;
    parts.push(`${over} over the ${accounting.capacity} capacity`);
  }

  const ticketWord = requested === 1 ? "This ticket is" : "These tickets are";
  return `${ticketWord} ${parts.join(", and ")}. Issue anyway?`;
}

function overageReasons(
  accounting: CompAccounting,
  requested: number,
): OverageReason[] {
  const reasons: OverageReason[] = [];
  if (
    accounting.allowance !== null &&
    accounting.issued + requested > accounting.allowance
  ) {
    reasons.push("ALLOWANCE");
  }
  if (
    accounting.capacity !== null &&
    accounting.headcount + requested > accounting.capacity
  ) {
    reasons.push("CAPACITY");
  }
  return reasons;
}

// ------------------------------------------------------------------ issuing

export type CompHandoutLine = {
  accessLevel: TicketAccessLevel;
  quantity: number;
};

export type IssuedComp = {
  orderId: string;
  orderNumber: string;
  hostTicketId: string;
  hostTicketNumber: string;
  ticketUrl: string;
  ticketCount: number;
  handoutCount: number;
};

/**
 * Mint a grant: one named ticket for the recipient, plus any they hand out.
 *
 * The recipient's ticket is name-locked at issue. That is the whole design —
 * everything else here is bookkeeping.
 */
export async function issueComp({
  eventId,
  recipientName,
  recipientEmail,
  accessLevel,
  handouts = [],
  notes,
  acknowledge = false,
  issuedByUserId,
}: {
  eventId: string;
  recipientName: string;
  recipientEmail?: string | null;
  accessLevel: TicketAccessLevel;
  handouts?: CompHandoutLine[];
  notes?: string | null;
  /** Set after the admin has seen and accepted an overage warning. */
  acknowledge?: boolean;
  issuedByUserId: string;
}): Promise<IssuedComp> {
  const handoutLines = handouts.filter((line) => line.quantity > 0);
  const handoutCount = handoutLines.reduce(
    (sum, line) => sum + line.quantity,
    0,
  );
  const requested = 1 + handoutCount;

  const orderNumber = await generateOrderNumber();

  return withEventInventoryLock(eventId, async (tx) => {
    const event = await tx.ticketEvent.findUnique({
      where: { id: eventId },
      select: { id: true, termsVersion: true },
    });
    if (!event) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Event not found." });
    }

    // Weighed as a whole grant: Bob's party of three warns as three, or not at
    // all. Warning about his AAA and then again about each friend would train
    // everyone to click through it.
    const accounting = await compAccounting(eventId, tx);
    const reasons = overageReasons(accounting, requested);
    if (reasons.length > 0 && !acknowledge) {
      throw new CompOverageError(reasons, accounting, requested);
    }

    const order = await tx.ticketOrder.create({
      data: {
        orderNumber,
        eventId,
        // A grant is settled the moment it is made: there is nothing to pay,
        // nothing to hold, and no window in which it could expire.
        status: TicketOrderStatus.PAID,
        paymentMethod: PaymentMethodKind.COMP,
        paidAt: new Date(),
        buyerName: recipientName,
        buyerEmail: recipientEmail?.toLowerCase().trim() ?? null,
        soldByUserId: issuedByUserId,
        notes: notes ?? null,
        termsVersion: event.termsVersion,
        // Accepted by the staff member making the grant, as at the door.
        termsAcceptedAt: new Date(),
        // No `items`: a comp is drawn from no tier, so there is no line to
        // write. This is why comp orders carry an empty items list.
      },
      select: { id: true, orderNumber: true },
    });

    const now = new Date();
    let seat = 0;

    const host = await tx.ticket.create({
      data: {
        ticketNumber: buildTicketNumber(order.orderNumber, seat++),
        orderId: order.id,
        eventId,
        tierId: null,
        isComp: true,
        accessLevel,
        attendeeName: recipientName,
        attendeeEmail: recipientEmail?.toLowerCase().trim() ?? null,
        // Locked from birth. Nobody holding the link can rename it, so handing
        // it on gains them nothing.
        nameLockedAt: now,
        qrSecret: generateQrSecret(),
        pricePaidCents: 0,
        status: TicketStatus.VALID,
      },
      select: { id: true, ticketNumber: true, accessTokenVersion: true },
    });

    for (const line of handoutLines) {
      for (let i = 0; i < line.quantity; i++) {
        await tx.ticket.create({
          data: {
            ticketNumber: buildTicketNumber(order.orderNumber, seat++),
            orderId: order.id,
            eventId,
            tierId: null,
            isComp: true,
            // Fixed here, at mint. The hand-out flow never sets a level, so
            // there is no path by which a guest ticket becomes an AAA.
            accessLevel: line.accessLevel,
            hostTicketId: host.id,
            invitedByName: recipientName,
            qrSecret: generateQrSecret(),
            pricePaidCents: 0,
            status: TicketStatus.VALID,
          },
        });
      }
    }

    await maybeMarkSoldOut(tx, eventId);

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      hostTicketId: host.id,
      hostTicketNumber: host.ticketNumber,
      ticketUrl: ticketUrl(ticketAccessToken(host)),
      ticketCount: requested,
      handoutCount,
    };
  });
}

// ----------------------------------------------------------------- hand-outs

/** Whether this ticket has been used to get somebody in. */
export async function hasBeenAdmitted(
  ticketId: string,
  client: Tx = db,
): Promise<boolean> {
  const scan = await client.ticketScan.findFirst({
    where: { ticketId, result: { in: [...ADMITTING_RESULTS] } },
    select: { id: true },
  });
  return scan !== null;
}

/**
 * Put a hand-out in somebody's name and mark it sent.
 *
 * Locks the name, so from here the ticket is theirs. Reassigning is a separate,
 * deliberate act that revokes the link first.
 */
export async function assignHandout({
  ticketId,
  guestName,
  guestEmail,
}: {
  ticketId: string;
  guestName: string;
  guestEmail?: string | null;
}): Promise<{ ticketId: string; ticketUrl: string }> {
  const ticket = await db.ticket.update({
    where: { id: ticketId },
    data: {
      attendeeName: guestName,
      attendeeEmail: guestEmail?.toLowerCase().trim() ?? null,
      nameLockedAt: new Date(),
      sentAt: new Date(),
    },
    select: { id: true, accessTokenVersion: true },
  });

  return {
    ticketId: ticket.id,
    ticketUrl: ticketUrl(ticketAccessToken(ticket)),
  };
}

/**
 * Take a hand-out back and free it for somebody else.
 *
 * Bumping `accessTokenVersion` kills the link already sent, which is the point:
 * the person who was going to come can no longer walk in on it.
 *
 * Refused once the ticket has been scanned in. Somebody is already inside on
 * it, and renaming it afterwards would rewrite who that was.
 */
export async function reassignHandout(ticketId: string): Promise<void> {
  if (await hasBeenAdmitted(ticketId)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "That ticket has already been used to get in, so it can't be given to somebody else.",
    });
  }

  await db.ticket.update({
    where: { id: ticketId },
    data: {
      attendeeName: null,
      attendeeEmail: null,
      nameLockedAt: null,
      sentAt: null,
      accessTokenVersion: { increment: 1 },
    },
  });
}
