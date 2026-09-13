import "server-only";

import { TRPCError } from "@trpc/server";

import {
  LifetimeTicketStatus,
  PaymentMethodKind,
  type Prisma,
  TicketOrderStatus,
  TicketStatus,
} from "~Prisma/client";
import { db } from "~/server/db";
import {
  buildLifetimeAccessToken,
  buildTicketNumber,
  generateLifetimeNumber,
  generateOrderNumber,
  parseLifetimeAccessToken,
  verifyLifetimeAccessToken,
} from "~/server/ticketing/numbering";
import { generateQrSecret } from "~/server/ticketing/qr";

/**
 * Lifetime passes.
 *
 * A pass is not a ticket. It belongs to no event and no order; it is one named
 * person and a level, with a QR of its own. What makes it work at a door
 * without the door learning a second set of rules is `materialise`: the first
 * scan at an event mints an ordinary ticket for that event, linked back to the
 * pass, and everything from there — duplicate, re-entry, refusal, headcount,
 * timeline — is the ticket machinery that already exists.
 *
 * The level is copied onto that ticket at mint. An upgrade in admin therefore
 * takes effect at the next event, and never rewrites a night already had.
 */

type Tx = Prisma.TransactionClient;

/** Trimmed, and null when there is nothing left — a form's empty string. */
function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === "" ? null : trimmed;
}

export async function createLifetimeTicket({
  holderName,
  holderEmail,
  accessLevel,
  notes,
  createdByUserId,
}: {
  holderName: string;
  holderEmail?: string | null;
  accessLevel: string;
  notes?: string | null;
  createdByUserId: string;
}) {
  const number = await generateLifetimeNumber();
  return db.lifetimeTicket.create({
    data: {
      number,
      holderName,
      holderEmail: blankToNull(holderEmail?.toLowerCase()),
      accessLevel,
      notes: blankToNull(notes),
      qrSecret: generateQrSecret(),
      createdByUserId,
    },
  });
}

/** Rebuild the holder's `/lifetime/[token]` link. */
export function lifetimeAccessToken(lifetime: {
  id: string;
  accessTokenVersion: number;
}): string {
  return buildLifetimeAccessToken(lifetime.id, lifetime.accessTokenVersion);
}

/**
 * The pass behind a holder's link, or null.
 *
 * A revoked pass still resolves: its page has to be able to say so, and a
 * wallet already holding it has to be told to expire it rather than left
 * frozen on a pass that looks live.
 */
export async function findLifetimeByAccessToken(token: string) {
  const parsed = parseLifetimeAccessToken(token);
  if (!parsed) return null;

  const lifetime = await db.lifetimeTicket.findUnique({
    where: { id: parsed.lifetimeId },
  });
  if (!lifetime) return null;
  if (!verifyLifetimeAccessToken(parsed, lifetime)) return null;
  return lifetime;
}

/**
 * The pass's ticket for this event, minted if this is its first scan here.
 *
 * Must run with the pass row locked (`FOR UPDATE`) so two doors scanning the
 * same pass at once produce one ticket, not two. The unique index on
 * `(lifetimeTicketId, eventId)` is the backstop.
 *
 * A pass consumes no allocation and no capacity: the holder was never going
 * to buy a ticket, and turning them away at a sold-out door defeats the point
 * of the pass. So there is no inventory lock here and no sold-out check.
 */
export async function materialiseLifetimeTicket(
  tx: Tx,
  lifetime: {
    id: string;
    number: string;
    holderName: string;
    holderEmail: string | null;
    accessLevel: string;
  },
  eventId: string,
): Promise<{ ticketId: string; created: boolean }> {
  const existing = await tx.ticket.findUnique({
    where: {
      lifetimeTicketId_eventId: { lifetimeTicketId: lifetime.id, eventId },
    },
    select: { id: true },
  });
  if (existing) return { ticketId: existing.id, created: false };

  const event = await tx.ticketEvent.findUnique({
    where: { id: eventId },
    select: { id: true, termsVersion: true },
  });
  if (!event) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Event not found." });
  }

  const orderNumber = await generateOrderNumber();
  const now = new Date();

  const order = await tx.ticketOrder.create({
    data: {
      orderNumber,
      eventId,
      // Settled the moment it exists: nothing to pay, nothing to hold.
      status: TicketOrderStatus.PAID,
      paymentMethod: PaymentMethodKind.LIFETIME,
      paidAt: now,
      buyerName: lifetime.holderName,
      buyerEmail: lifetime.holderEmail,
      notes: `Lifetime pass ${lifetime.number}`,
      termsVersion: event.termsVersion,
      termsAcceptedAt: now,
      // No `items`: drawn from no tier, like a comp.
    },
    select: { id: true, orderNumber: true },
  });

  const ticket = await tx.ticket.create({
    data: {
      ticketNumber: buildTicketNumber(order.orderNumber, 0),
      orderId: order.id,
      eventId,
      tierId: null,
      lifetimeTicketId: lifetime.id,
      accessLevel: lifetime.accessLevel,
      attendeeName: lifetime.holderName,
      attendeeEmail: lifetime.holderEmail,
      // The pass is in one person's name, and so is every ticket it mints.
      nameLockedAt: now,
      // Never handed out — the holder's QR is the pass's own — but a ticket
      // row needs one, and a random one keeps it unguessable regardless.
      qrSecret: generateQrSecret(),
      pricePaidCents: 0,
      status: TicketStatus.VALID,
    },
    select: { id: true },
  });

  return { ticketId: ticket.id, created: true };
}

/** Whether the pass can still open a door. */
export function isLifetimeActive(lifetime: {
  status: LifetimeTicketStatus;
}): boolean {
  return lifetime.status === LifetimeTicketStatus.ACTIVE;
}
